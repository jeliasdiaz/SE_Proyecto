-- Rendimiento de la bandeja y del panel del admin. Medido con 200 000 solicitudes:
--   chip "Mías"                 51 ms → 15 ms   (índice en responsable_id)
--   8 conteos de la bandeja   ~400 ms → 85 ms   (un solo recorrido: conteos_bandeja)
--   carga_por_asesor         1212 ms → 118 ms  (fecha de cierre guardada en la solicitud)

-- 1. responsable_id es llave foránea y no tenía índice: lo usan el chip "Mías", la carga por
-- asesor, la política de update del asesor y el "on delete set null" al borrar un perfil.
create index solicitudes_responsable_idx on public.solicitudes (responsable_id, creada desc);

-- 3. Fecha del último cierre (finalizada o rechazada); nula si el caso está abierto o se reabrió.
-- La mantiene el trigger: nadie tiene permiso de escribirla directamente.
alter table public.solicitudes add column cerrada timestamptz;

update public.solicitudes s
set cerrada = h.fecha
from (
  select solicitud_id, max(fecha) as fecha
  from public.historial_estados
  where estado_nuevo in ('finalizada', 'rechazada')
  group by solicitud_id
) h
where h.solicitud_id = s.id
  and s.estado in ('finalizada', 'rechazada');

create or replace function public.validar_cambio_solicitud()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_es_admin boolean := public.es_admin();
  v_es_asesor boolean := public.es_asesor();
  v_reapertura boolean := old.estado in ('finalizada', 'rechazada') and new.estado = 'en_proceso';
  v_nombre text;
begin
  -- Los permisos por columna son por rol de Postgres, no por usuario: el estudiante hereda el grant
  -- de update del personal. Lo único que puede hacer es retirar su solicitud pendiente.
  -- n8n (llave de servicio) no pasa por aquí.
  if (select auth.role()) = 'authenticated' and not v_es_admin and not v_es_asesor then
    if not (
      old.estado = 'pendiente'
      and new.estado = 'retirada'
      and new.tipo is not distinct from old.tipo
      and new.observaciones is not distinct from old.observaciones
      and new.revision is not distinct from old.revision
      and new.motivo_revision is not distinct from old.motivo_revision
      and new.responsable_id is not distinct from old.responsable_id
    ) then
      raise exception 'Solo puedes retirar una solicitud que siga pendiente'
        using errcode = 'check_violation';
    end if;
  end if;

  if v_es_asesor then
    if old.estudiante_id = v_usuario then
      raise exception 'No puedes gestionar una solicitud que registraste tú'
        using errcode = 'check_violation';
    end if;

    if old.responsable_id is not null and old.responsable_id <> v_usuario then
      select nombre into v_nombre from public.perfiles where id = old.responsable_id;
      raise exception 'Esta solicitud ya la atiende %', coalesce(v_nombre, 'otra persona')
        using errcode = 'check_violation';
    end if;

    -- Tocar un caso libre es tomarlo: nadie gestiona una solicitud sin quedar como responsable.
    if old.responsable_id is null and new.responsable_id is null then
      new.responsable_id := v_usuario;
    end if;

    if new.responsable_id is distinct from v_usuario then
      raise exception 'Solo un administrador puede reasignar o liberar una solicitud'
        using errcode = 'check_violation';
    end if;
  end if;

  if new.estado is distinct from old.estado then
    if v_reapertura and not v_es_admin then
      raise exception 'Solo un administrador puede reabrir una solicitud cerrada'
        using errcode = 'check_violation';
    end if;

    if not (
      (old.estado = 'pendiente' and new.estado in ('en_proceso', 'rechazada', 'retirada'))
      or (old.estado = 'en_proceso' and new.estado in ('finalizada', 'rechazada', 'retirada'))
      or v_reapertura
    ) then
      raise exception 'Transición no permitida: % → %', old.estado, new.estado
        using errcode = 'check_violation';
    end if;

    -- La observación pertenece a la transición: si no llega una nueva, no se arrastra la anterior.
    if new.observaciones is not distinct from old.observaciones then
      new.observaciones := null;
    end if;
    new.observaciones := nullif(btrim(new.observaciones), '');

    if new.estado = 'rechazada' and new.observaciones is null then
      raise exception 'Rechazar una solicitud exige una observación'
        using errcode = 'check_violation';
    end if;

    -- El retiro que registra la coordinación deja constancia de por qué; el del estudiante no lleva texto.
    if new.estado = 'retirada' and (v_es_admin or v_es_asesor) and new.observaciones is null then
      raise exception 'Registrar un retiro exige una observación'
        using errcode = 'check_violation';
    end if;

    if v_reapertura and new.observaciones is null then
      raise exception 'Reabrir una solicitud exige una observación'
        using errcode = 'check_violation';
    end if;

    -- Si el admin mueve un caso libre, queda como responsable (F3 le escribe a esa persona).
    -- Si lo mueve el estudiante al retirarlo, sigue sin responsable.
    if new.responsable_id is null and v_es_admin then
      new.responsable_id := v_usuario;
    end if;

    -- Fecha de cierre guardada en la fila para que las métricas no recorran el historial.
    -- Un caso reabierto deja de estar cerrado.
    if new.estado in ('finalizada', 'rechazada') then
      new.cerrada := now();
    elsif v_reapertura then
      new.cerrada := null;
    end if;
  end if;

  if new.responsable_id is distinct from old.responsable_id and new.responsable_id is not null then
    if new.responsable_id = new.estudiante_id then
      raise exception 'El responsable no puede ser el mismo estudiante que registró la solicitud'
        using errcode = 'check_violation';
    end if;
    if not public.puede_ser_responsable(new.responsable_id) then
      raise exception 'El responsable debe ser un asesor o un administrador'
        using errcode = 'check_violation';
    end if;
  end if;

  new.actualizada := now();
  return new;
end;
$$;

revoke execute on function public.validar_cambio_solicitud() from public, anon, authenticated;

-- Mismas columnas que antes (create or replace view no permite cambiarlas); ahora agrupa las
-- solicitudes por responsable en un solo recorrido y une el resultado con los perfiles.
create or replace view public.carga_por_asesor
with (security_invoker = true) as
with por_responsable as (
  select
    responsable_id,
    count(*) filter (where estado = 'pendiente')::integer as pendientes,
    count(*) filter (where estado = 'en_proceso')::integer as en_proceso,
    count(*) filter (where estado = 'finalizada')::integer as finalizadas,
    count(*) filter (where estado = 'rechazada')::integer as rechazadas,
    count(*) filter (where estado = 'retirada')::integer as retiradas,
    count(*) filter (
      where estado in ('pendiente', 'en_proceso')
        and actualizada < now() - make_interval(days => public.dias_recordatorio())
    )::integer as estancadas,
    round((avg(extract(epoch from cerrada - creada)) / 3600)::numeric, 1) as horas_resolucion,
    max(actualizada) as ultima_actividad
  from public.solicitudes
  where responsable_id is not null
  group by responsable_id
)
select
  p.id,
  p.nombre,
  p.correo,
  p.rol,
  coalesce(r.pendientes, 0) as pendientes,
  coalesce(r.en_proceso, 0) as en_proceso,
  coalesce(r.finalizadas, 0) as finalizadas,
  coalesce(r.rechazadas, 0) as rechazadas,
  coalesce(r.retiradas, 0) as retiradas,
  coalesce(r.estancadas, 0) as estancadas,
  r.horas_resolucion,
  r.ultima_actividad
from public.perfiles p
left join por_responsable r on r.responsable_id = p.id
where p.rol in ('asesor', 'admin')
  and (select public.es_admin());

create or replace view public.metricas_tiempos_por_tipo
with (security_invoker = true) as
with primera_atencion as (
  select solicitud_id, min(fecha) as fecha
  from public.historial_estados
  where estado_anterior = 'pendiente'
    and estado_nuevo <> 'retirada'
  group by solicitud_id
)
select
  s.tipo,
  count(*)::integer as total,
  count(s.cerrada)::integer as cerradas,
  round((avg(extract(epoch from pa.fecha - s.creada)) / 3600)::numeric, 1) as horas_primera_atencion,
  round((avg(extract(epoch from s.cerrada - s.creada)) / 3600)::numeric, 1) as horas_resolucion
from public.solicitudes s
left join primera_atencion pa on pa.solicitud_id = s.id
where (select public.es_admin())
group by s.tipo;

-- 2. Todos los conteos de la bandeja en un solo recorrido. Antes eran 8 consultas, y con el
-- refresco en vivo cada bandeja abierta las repetía en cada cambio de cualquier asesor.
-- Cada conteo omite el filtro que desglosa (igual que aplicarFiltros en gestion/page.tsx):
-- las pestañas ignoran el estado elegido, el chip "Por revisar" la revisión y los chips de
-- responsable el responsable. security invoker: respeta RLS como cualquier consulta.
create function public.conteos_bandeja(
  p_estado public.estado_solicitud default null,
  p_tipo public.tipo_solicitud default null,
  p_origen public.origen_solicitud default null,
  p_por_revisar boolean default false,
  p_responsable uuid default null,
  p_solo_libres boolean default false,
  p_q text default null
)
returns table (
  pendiente integer,
  en_proceso integer,
  finalizada integer,
  rechazada integer,
  retirada integer,
  por_revisar integer,
  mias integer,
  libres integer
)
language sql
stable
set search_path = ''
as $$
  with base as (
    select
      s.estado,
      s.revision,
      s.responsable_id,
      (p_estado is null or s.estado = p_estado) as ok_estado,
      (not p_por_revisar or s.revision = 'por_revisar') as ok_revision,
      case
        when p_solo_libres then s.responsable_id is null and s.estado in ('pendiente', 'en_proceso')
        when p_responsable is not null then s.responsable_id = p_responsable
        else true
      end as ok_responsable
    from public.solicitudes s
    where (p_tipo is null or s.tipo = p_tipo)
      and (p_origen is null or s.origen = p_origen)
      and (
        p_q is null
        or s.asunto ilike '%' || p_q || '%'
        or s.descripcion ilike '%' || p_q || '%'
      )
  )
  select
    count(*) filter (where estado = 'pendiente' and ok_revision and ok_responsable)::integer,
    count(*) filter (where estado = 'en_proceso' and ok_revision and ok_responsable)::integer,
    count(*) filter (where estado = 'finalizada' and ok_revision and ok_responsable)::integer,
    count(*) filter (where estado = 'rechazada' and ok_revision and ok_responsable)::integer,
    count(*) filter (where estado = 'retirada' and ok_revision and ok_responsable)::integer,
    count(*) filter (where revision = 'por_revisar' and ok_estado and ok_responsable)::integer,
    count(*) filter (where responsable_id = (select auth.uid()) and ok_estado and ok_revision)::integer,
    count(*) filter (
      where responsable_id is null and estado in ('pendiente', 'en_proceso') and ok_estado and ok_revision
    )::integer
  from base;
$$;

revoke execute on function public.conteos_bandeja(
  public.estado_solicitud, public.tipo_solicitud, public.origen_solicitud, boolean, uuid, boolean, text
) from public, anon;
grant execute on function public.conteos_bandeja(
  public.estado_solicitud, public.tipo_solicitud, public.origen_solicitud, boolean, uuid, boolean, text
) to authenticated;
