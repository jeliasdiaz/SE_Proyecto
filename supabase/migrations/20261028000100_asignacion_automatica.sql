-- Asignación automática y fin de la clasificación "por revisar".
--
-- 1. Cada solicitud nueva (web o correo) queda a cargo del asesor con menos solicitudes abiertas.
--    Lo decide la base y no la web: F4 crea solicitudes sin pasar por la interfaz, y el estudiante
--    no puede ver la carga de los asesores. El INSERT dispara F1, que avisa al asesor asignado.
-- 2. Se quita la marca "por revisar": F4 siempre asigna un tipo (el que reconoce o "otro") y el
--    personal lo corrige desde el panel de clasificación si hace falta.

-- ---------------------------------------------------------------------------------------------
-- 1. Asignación automática.
-- ---------------------------------------------------------------------------------------------

-- Carga = solicitudes pendientes o en proceso (lo mismo que la barra de carga del panel del admin).
-- Empate: el que lleva más tiempo sin recibir un caso, para repartir por turnos.
-- Sin asesores, la solicitud queda sin asignar y cualquiera del personal puede tomarla.
-- security definer: quien inserta (el estudiante) no ve las solicitudes ni los perfiles ajenos.
create function public.asignar_responsable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asesor uuid;
begin
  if new.responsable_id is not null then
    return new;
  end if;

  -- Dos solicitudes que llegan a la vez esperan su turno: si no, ambas verían la misma carga y
  -- caerían en el mismo asesor. El bloqueo dura hasta el final de la transacción.
  perform pg_advisory_xact_lock(hashtext('public.asignar_responsable'));

  select p.id
  into v_asesor
  from public.perfiles p
  left join lateral (
    select
      count(*) filter (where s.estado in ('pendiente', 'en_proceso')) as abiertas,
      max(s.creada) as ultima
    from public.solicitudes s
    where s.responsable_id = p.id
  ) c on true
  where p.rol = 'asesor'
    and p.id <> new.estudiante_id
  order by c.abiertas, c.ultima nulls first, p.id
  limit 1;

  -- Bloquea el perfil para que cambiar_rol() no lo degrade mientras recibe el caso; si justo dejó
  -- de ser asesor, la solicitud queda sin asignar.
  if v_asesor is not null and public.puede_ser_responsable(v_asesor) then
    new.responsable_id := v_asesor;
  end if;

  return new;
end;
$$;

revoke execute on function public.asignar_responsable() from public, anon, authenticated;

create trigger asignar_responsable
before insert on public.solicitudes
for each row execute function public.asignar_responsable();

-- ---------------------------------------------------------------------------------------------
-- 2. Sin "por revisar". Primero las funciones que leen las columnas, después las columnas.
-- ---------------------------------------------------------------------------------------------

drop function public.conteos_bandeja(
  public.estado_solicitud, public.tipo_solicitud, public.origen_solicitud, boolean, uuid, boolean, text
);

-- Igual que antes, sin el chip "Por revisar".
create function public.conteos_bandeja(
  p_estado public.estado_solicitud default null,
  p_tipo public.tipo_solicitud default null,
  p_origen public.origen_solicitud default null,
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
      s.responsable_id,
      (p_estado is null or s.estado = p_estado) as ok_estado,
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
    count(*) filter (where estado = 'pendiente' and ok_responsable)::integer,
    count(*) filter (where estado = 'en_proceso' and ok_responsable)::integer,
    count(*) filter (where estado = 'finalizada' and ok_responsable)::integer,
    count(*) filter (where estado = 'rechazada' and ok_responsable)::integer,
    count(*) filter (where estado = 'retirada' and ok_responsable)::integer,
    count(*) filter (where responsable_id = (select auth.uid()) and ok_estado)::integer,
    count(*) filter (
      where responsable_id is null and estado in ('pendiente', 'en_proceso') and ok_estado
    )::integer
  from base;
$$;

revoke execute on function public.conteos_bandeja(
  public.estado_solicitud, public.tipo_solicitud, public.origen_solicitud, uuid, boolean, text
) from public, anon;
grant execute on function public.conteos_bandeja(
  public.estado_solicitud, public.tipo_solicitud, public.origen_solicitud, uuid, boolean, text
) to authenticated;

-- Igual que en 20260926000100_rendimiento.sql, sin revision ni motivo_revision en la regla del
-- estudiante.
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

-- El índice parcial solicitudes_por_revisar_idx y los permisos de update sobre estas columnas
-- se van con ellas.
alter table public.solicitudes
  drop column revision,
  drop column motivo_revision;

drop type public.estado_revision;
