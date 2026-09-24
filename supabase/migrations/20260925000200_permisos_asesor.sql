-- Rol asesor. El asesor atiende la bandeja: ve todas las solicitudes, toma las que están sin
-- responsable y solo gestiona las suyas. El admin supervisa: gestiona cualquier caso, reasigna,
-- reabre casos cerrados, cambia roles (estudiante ↔ asesor) y ve las métricas.
-- "Una solicitud, un responsable" lo garantiza la base (RLS + trigger), no la interfaz: dos
-- asesores que la toman a la vez compiten por el mismo bloqueo de fila y solo uno la obtiene.

create function public.es_asesor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = (select auth.uid())
      and rol = 'asesor'
  );
$$;

-- Personal de la coordinación: asesor o admin.
create function public.es_personal()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = (select auth.uid())
      and rol in ('asesor', 'admin')
  );
$$;

revoke execute on function public.es_asesor(), public.es_personal() from public, anon;
grant execute on function public.es_asesor(), public.es_personal() to authenticated, service_role;

-- ¿Puede esta persona ser responsable de un caso? Bloquea su perfil (for share) hasta el final de
-- la transacción para que cambiar_rol() no la degrade mientras toma o recibe un caso.
-- security definer: el bloqueo exige permiso de update sobre perfiles, que los usuarios no tienen.
-- La llama el trigger, que corre con el rol de quien actualiza: por eso authenticated la ejecuta.
create function public.puede_ser_responsable(p_usuario uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1
  from public.perfiles
  where id = p_usuario
    and rol in ('asesor', 'admin')
  for share;
  return found;
end;
$$;

revoke execute on function public.puede_ser_responsable(uuid) from public, anon;
grant execute on function public.puede_ser_responsable(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Políticas: donde decía "admin" para ver, ahora es "personal". Métricas y avisos siguen solo admin.
-- ---------------------------------------------------------------------------------------------

drop policy "perfiles: el propio o admin" on public.perfiles;
create policy "perfiles: el propio o el personal"
on public.perfiles for select to authenticated
using (id = (select auth.uid()) or (select public.es_personal()));

drop policy "solicitudes: el estudiante ve las suyas, el admin todas" on public.solicitudes;
create policy "solicitudes: el estudiante ve las suyas, el personal todas"
on public.solicitudes for select to authenticated
using (estudiante_id = (select auth.uid()) or (select public.es_personal()));

drop policy "solicitudes: el estudiante crea a su nombre" on public.solicitudes;
create policy "solicitudes: el estudiante crea a su nombre"
on public.solicitudes for insert to authenticated
with check (estudiante_id = (select auth.uid()) and not (select public.es_personal()));

-- El asesor solo alcanza los casos libres o los suyos, nunca uno propio como estudiante.
-- El with check se evalúa después del trigger, que ya fijó al asesor como responsable.
drop policy "solicitudes: el admin gestiona" on public.solicitudes;
create policy "solicitudes: el personal gestiona"
on public.solicitudes for update to authenticated
using (
  (select public.es_admin())
  or (
    (select public.es_asesor())
    and (responsable_id is null or responsable_id = (select auth.uid()))
    and estudiante_id <> (select auth.uid())
  )
)
with check (
  (select public.es_admin())
  or ((select public.es_asesor()) and responsable_id = (select auth.uid()))
);

drop policy "historial: visible con su solicitud" on public.historial_estados;
create policy "historial: visible con su solicitud"
on public.historial_estados for select to authenticated
using (
  (select public.es_personal())
  or exists (
    select 1 from public.solicitudes s
    where s.id = solicitud_id
      and s.estudiante_id = (select auth.uid())
  )
);

drop policy "adjuntos: leer los propios o admin" on storage.objects;
create policy "adjuntos: leer los propios o el personal"
on storage.objects for select to authenticated
using (
  bucket_id = 'adjuntos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.es_personal())
  )
);

-- ---------------------------------------------------------------------------------------------
-- Reglas de cambio por rol.
-- ---------------------------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------------------------
-- Gestión de roles desde la web: solo estudiante ↔ asesor. El rol admin se sigue asignando por
-- SQL, así una cuenta admin robada no puede fabricar más admins.
-- ---------------------------------------------------------------------------------------------

create function public.cambiar_rol(p_usuario uuid, p_rol public.rol_usuario)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actual public.rol_usuario;
  v_abiertas integer;
begin
  if not public.es_admin() then
    raise exception 'Solo un administrador puede cambiar roles'
      using errcode = 'insufficient_privilege';
  end if;

  if p_rol not in ('estudiante', 'asesor') then
    raise exception 'El rol de administrador solo se asigna directamente en la base de datos'
      using errcode = 'check_violation';
  end if;

  if p_usuario = (select auth.uid()) then
    raise exception 'No puedes cambiar tu propio rol'
      using errcode = 'check_violation';
  end if;

  -- for update: espera a que termine cualquier toma de caso en curso (ver puede_ser_responsable).
  select rol into v_actual from public.perfiles where id = p_usuario for update;
  if not found then
    raise exception 'El usuario no existe'
      using errcode = 'check_violation';
  end if;

  if v_actual = 'admin' then
    raise exception 'El rol de un administrador no se cambia desde la aplicación'
      using errcode = 'check_violation';
  end if;

  if v_actual = p_rol then
    return;
  end if;

  if v_actual = 'asesor' then
    select count(*) into v_abiertas
    from public.solicitudes
    where responsable_id = p_usuario
      and estado in ('pendiente', 'en_proceso');
    if v_abiertas > 0 then
      raise exception 'Reasigna primero sus % solicitudes abiertas', v_abiertas
        using errcode = 'check_violation';
    end if;
  end if;

  update public.perfiles set rol = p_rol where id = p_usuario;
end;
$$;

revoke execute on function public.cambiar_rol(uuid, public.rol_usuario) from public, anon;
grant execute on function public.cambiar_rol(uuid, public.rol_usuario) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Métricas.
-- ---------------------------------------------------------------------------------------------

-- Carga de cada persona que puede ser responsable. Resolución: desde la creación hasta el último
-- cierre, solo para casos que siguen cerrados.
create view public.carga_por_asesor
with (security_invoker = true) as
with cierre as (
  select solicitud_id, max(fecha) as fecha
  from public.historial_estados
  where estado_nuevo in ('finalizada', 'rechazada')
  group by solicitud_id
)
select
  p.id,
  p.nombre,
  p.correo,
  p.rol,
  count(s.id) filter (where s.estado = 'pendiente')::integer as pendientes,
  count(s.id) filter (where s.estado = 'en_proceso')::integer as en_proceso,
  count(s.id) filter (where s.estado = 'finalizada')::integer as finalizadas,
  count(s.id) filter (where s.estado = 'rechazada')::integer as rechazadas,
  count(s.id) filter (where s.estado = 'retirada')::integer as retiradas,
  count(s.id) filter (
    where s.estado in ('pendiente', 'en_proceso')
      and s.actualizada < now() - make_interval(days => public.dias_recordatorio())
  )::integer as estancadas,
  round(
    (avg(extract(epoch from c.fecha - s.creada)) filter (where s.estado in ('finalizada', 'rechazada')) / 3600)::numeric,
    1
  ) as horas_resolucion,
  max(s.actualizada) as ultima_actividad
from public.perfiles p
left join public.solicitudes s on s.responsable_id = p.id
left join cierre c on c.solicitud_id = s.id
where p.rol in ('asesor', 'admin')
  and (select public.es_admin())
group by p.id;

revoke all on public.carga_por_asesor from anon, authenticated;
grant select on public.carga_por_asesor to authenticated;

-- Con la reapertura, un caso reabierto tiene un cierre en el historial pero ya no está cerrado.
create or replace view public.metricas_tiempos_por_tipo
with (security_invoker = true) as
with primera_atencion as (
  select solicitud_id, min(fecha) as fecha
  from public.historial_estados
  where estado_anterior = 'pendiente'
    and estado_nuevo <> 'retirada'
  group by solicitud_id
),
cierre as (
  select solicitud_id, max(fecha) as fecha
  from public.historial_estados
  where estado_nuevo in ('finalizada', 'rechazada')
  group by solicitud_id
)
select
  s.tipo,
  count(*)::integer as total,
  count(c.fecha)::integer as cerradas,
  round((avg(extract(epoch from pa.fecha - s.creada)) / 3600)::numeric, 1) as horas_primera_atencion,
  round((avg(extract(epoch from c.fecha - s.creada)) / 3600)::numeric, 1) as horas_resolucion
from public.solicitudes s
left join primera_atencion pa on pa.solicitud_id = s.id
left join cierre c on c.solicitud_id = s.id and s.estado in ('finalizada', 'rechazada')
where (select public.es_admin())
group by s.tipo;

-- ---------------------------------------------------------------------------------------------
-- Realtime: la bandeja se refresca cuando otro asesor toma o mueve un caso. Respeta RLS.
-- ---------------------------------------------------------------------------------------------

alter publication supabase_realtime add table public.solicitudes;
