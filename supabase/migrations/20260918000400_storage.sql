-- Adjuntos privados: se descargan solo con URL firmada de corta duración (R5).
-- Ruta: adjuntos/{estudiante_id}/{solicitud_id}/{archivo}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('adjuntos', 'adjuntos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

create policy "adjuntos: subir en la carpeta propia"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'adjuntos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "adjuntos: leer los propios o admin"
on storage.objects for select to authenticated
using (
  bucket_id = 'adjuntos'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or (select public.es_admin())
  )
);

-- Sin update ni delete: el adjunto es evidencia del caso.
