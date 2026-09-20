-- La frontera de seguridad es la base de datos: cualquier estudiante puede llamar la API con su
-- token sin pasar por la interfaz. Los permisos por columna definen QUÉ se puede escribir;
-- las políticas RLS definen SOBRE CUÁLES filas.

alter table public.perfiles enable row level security;
alter table public.solicitudes enable row level security;
alter table public.historial_estados enable row level security;
alter table public.avisos_enviados enable row level security;

-- Supabase concede todo a anon/authenticated por defecto; se parte de cero.
revoke all on public.perfiles, public.solicitudes, public.historial_estados, public.avisos_enviados
  from anon, authenticated;

grant select on public.perfiles to authenticated;
grant select on public.solicitudes to authenticated;
grant select on public.historial_estados to authenticated;
grant select on public.avisos_enviados to authenticated;

-- El estudiante no puede fijar estado, origen, revisión ni dueño: esas columnas toman su valor por defecto.
grant insert (id, tipo, asunto, descripcion, adjunto_path) on public.solicitudes to authenticated;

-- Lo único que el admin puede cambiar. estudiante_id, origen, adjunto y fechas quedan fijos.
grant update (estado, observaciones, tipo, revision, motivo_revision, responsable_id)
  on public.solicitudes to authenticated;

-- perfiles: sin insert/update desde la API (el rol solo se cambia por SQL).
create policy "perfiles: el propio o admin"
on public.perfiles for select to authenticated
using (id = (select auth.uid()) or (select public.es_admin()));

create policy "solicitudes: el estudiante ve las suyas, el admin todas"
on public.solicitudes for select to authenticated
using (estudiante_id = (select auth.uid()) or (select public.es_admin()));

create policy "solicitudes: el estudiante crea a su nombre"
on public.solicitudes for insert to authenticated
with check (estudiante_id = (select auth.uid()) and not (select public.es_admin()));

create policy "solicitudes: el admin gestiona"
on public.solicitudes for update to authenticated
using ((select public.es_admin()))
with check ((select public.es_admin()));

create policy "historial: visible con su solicitud"
on public.historial_estados for select to authenticated
using (
  (select public.es_admin())
  or exists (
    select 1 from public.solicitudes s
    where s.id = solicitud_id
      and s.estudiante_id = (select auth.uid())
  )
);

create policy "avisos: solo admin"
on public.avisos_enviados for select to authenticated
using ((select public.es_admin()));
