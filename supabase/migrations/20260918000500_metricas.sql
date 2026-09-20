-- Indicadores del proceso para el panel de administración.
-- security_invoker: la vista respeta RLS (por defecto una vista la ignora). El filtro es_admin()
-- hace que un estudiante reciba vacío en vez de métricas parciales.

create view public.metricas_por_estado
with (security_invoker = true) as
select estado, count(*)::integer as total
from public.solicitudes
where (select public.es_admin())
group by estado;

-- Primera atención: primer cambio que saca el caso de 'pendiente'.
-- Resolución: llegada a 'finalizada' o 'rechazada'. Ambas medidas en horas desde la creación.
create view public.metricas_tiempos_por_tipo
with (security_invoker = true) as
with primera_atencion as (
  select solicitud_id, min(fecha) as fecha
  from public.historial_estados
  where estado_anterior = 'pendiente'
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

create view public.solicitudes_estancadas
with (security_invoker = true) as
select
  s.id,
  s.asunto,
  s.tipo,
  s.estado,
  s.responsable_id,
  s.actualizada,
  floor(extract(epoch from now() - s.actualizada) / 86400)::integer as dias_sin_cambio
from public.solicitudes s
where s.estado in ('pendiente', 'en_proceso')
  and s.actualizada < now() - make_interval(days => public.dias_recordatorio())
  and (select public.es_admin());

revoke all on public.metricas_por_estado, public.metricas_tiempos_por_tipo, public.solicitudes_estancadas
  from anon, authenticated;
grant select on public.metricas_por_estado, public.metricas_tiempos_por_tipo, public.solicitudes_estancadas
  to authenticated;
