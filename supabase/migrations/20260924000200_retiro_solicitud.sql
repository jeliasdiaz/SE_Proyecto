-- Retiro de solicitudes: el estudiante retira la suya mientras está pendiente; desde en_proceso
-- ya hay un responsable, así que solo el admin puede registrar el retiro (con observación).

create or replace function public.validar_cambio_solicitud()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_es_admin boolean := public.es_admin();
begin
  -- Los permisos por columna son por rol, no por usuario: el estudiante hereda el grant de update
  -- del admin. Lo único que puede hacer es retirar su solicitud pendiente, sin tocar nada más.
  -- n8n (llave de servicio) no pasa por aquí.
  if (select auth.role()) = 'authenticated' and not v_es_admin then
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

  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'pendiente' and new.estado in ('en_proceso', 'rechazada', 'retirada'))
      or (old.estado = 'en_proceso' and new.estado in ('finalizada', 'rechazada', 'retirada'))
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

    -- El retiro que registra el admin deja constancia de por qué; el del estudiante no lleva texto.
    if new.estado = 'retirada' and v_es_admin and new.observaciones is null then
      raise exception 'Registrar un retiro exige una observación'
        using errcode = 'check_violation';
    end if;

    -- El primer admin que mueve el caso queda como responsable (F3 le escribe a esa persona).
    -- Si el caso lo mueve el estudiante al retirarlo, sigue sin responsable.
    if new.responsable_id is null and v_es_admin then
      new.responsable_id := (select auth.uid());
    end if;
  end if;

  if new.responsable_id is distinct from old.responsable_id
     and new.responsable_id is not null
     and not exists (
       select 1 from public.perfiles
       where id = new.responsable_id and rol = 'admin'
     ) then
    raise exception 'El responsable debe ser un administrador'
      using errcode = 'check_violation';
  end if;

  new.actualizada := now();
  return new;
end;
$$;

revoke execute on function public.validar_cambio_solicitud() from public, anon, authenticated;

create policy "solicitudes: el estudiante retira la suya pendiente"
on public.solicitudes for update to authenticated
using (estudiante_id = (select auth.uid()) and estado = 'pendiente')
with check (estudiante_id = (select auth.uid()) and estado = 'retirada');

-- Un retiro desde 'pendiente' no es atención de la coordinación ni resolución del caso.
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
left join cierre c on c.solicitud_id = s.id
where (select public.es_admin())
group by s.tipo;
