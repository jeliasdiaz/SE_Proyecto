-- Quita lo que creó supabase/seed-organico.sql: los estudiantes sintéticos (ids
-- 00000000-0000-4000-b000-…) y, en cascada, sus solicitudes, su historial y sus avisos; también
-- las respuestas de ejemplo de F4 a remitentes sin cuenta. No toca al personal ni a las cuentas
-- reales. Las 3 solicitudes del estudiante de la demo (c_estudiante_demo) no se distinguen de las
-- suyas: para empezar de cero del todo, vacía la base (docs/plan-qa-demo.md).
begin;

delete from public.avisos_enviados
where tipo_aviso = 'remitente_desconocido' and destinatario like '%.test';

delete from auth.users where id::text like '00000000-0000-4000-b000-%';

commit;

select
  (select count(*) from auth.users where id::text like '00000000-0000-4000-b000-%') as estudiantes_sinteticos,
  (select count(*) from public.solicitudes) as solicitudes;
