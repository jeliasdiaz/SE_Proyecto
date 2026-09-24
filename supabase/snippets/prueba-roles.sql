-- ============================================================================================
-- PRUEBA DE PERMISOS POR ROL (estudiante / asesor / admin). Solo para Supabase local, después de
-- `npx supabase db reset` (usa los usuarios de seed.sql). Todo corre en una transacción que se
-- deshace al final: no deja cambios.
--
--   psql "$(npx supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/snippets/prueba-roles.sql
--
-- Si algo falla, se detiene con el número de la prueba. Si todo pasa, termina con "prueba-roles: ok".
-- ============================================================================================

\set ON_ERROR_STOP on
\set QUIET on
\o /dev/null

begin;

-- Actúa como el usuario con ese correo (como lo haría PostgREST con su token).
create function pg_temp.como(p_correo text) returns void language plpgsql as $$
declare
  v_id uuid;
begin
  reset role;
  select id into strict v_id from public.perfiles where correo = p_correo;
  perform set_config('request.jwt.claims', json_build_object('sub', v_id, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Ejecuta la sentencia y comprueba cuántas filas tocó.
create function pg_temp.filas(p_prueba text, p_sql text, p_esperadas integer) returns void language plpgsql as $$
declare
  v_filas integer;
begin
  execute p_sql;
  get diagnostics v_filas = row_count;
  if v_filas <> p_esperadas then
    raise exception '[%] esperaba % filas y fueron %', p_prueba, p_esperadas, v_filas;
  end if;
end;
$$;

-- Ejecuta la sentencia y comprueba que falle con un mensaje que contenga el fragmento.
create function pg_temp.falla(p_prueba text, p_sql text, p_fragmento text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception '[%] esperaba el error "%" y no falló', p_prueba, p_fragmento;
exception
  when others then
    if sqlerrm like '[%' then
      raise;
    end if;
    if position(p_fragmento in sqlerrm) = 0 then
      raise exception '[%] esperaba "%" y el error fue "%"', p_prueba, p_fragmento, sqlerrm;
    end if;
end;
$$;

-- Comprueba el resultado de una consulta escalar.
create function pg_temp.vale(p_prueba text, p_sql text, p_esperado text) returns void language plpgsql as $$
declare
  v_valor text;
begin
  execute p_sql into v_valor;
  if v_valor is distinct from p_esperado then
    raise exception '[%] esperaba % y fue %', p_prueba, p_esperado, v_valor;
  end if;
end;
$$;

grant execute on all functions in schema pg_temp to authenticated;

-- Casos de trabajo, elegidos como superusuario.
select
  (select s.id from public.solicitudes s join public.perfiles e on e.id = s.estudiante_id
   where s.estado = 'pendiente' and s.responsable_id is null and e.correo = 'ana.gomez@demo.test'
   order by s.creada limit 1) as libre1,
  (select s.id from public.solicitudes s join public.perfiles e on e.id = s.estudiante_id
   where s.estado = 'pendiente' and s.responsable_id is null and e.correo <> 'ana.gomez@demo.test'
   order by s.creada limit 1) as libre2,
  (select s.id from public.solicitudes s join public.perfiles e on e.id = s.estudiante_id
   where s.estado = 'pendiente' and s.responsable_id is null and e.correo = 'ana.gomez@demo.test'
   order by s.creada desc limit 1) as de_ana,
  (select s.id from public.solicitudes s join public.perfiles r on r.id = s.responsable_id
   where s.estado = 'en_proceso' and r.correo = 'mateo.restrepo@demo.test' limit 1) as de_mateo,
  (select s.id from public.solicitudes s join public.perfiles r on r.id = s.responsable_id
   where s.estado = 'finalizada' and r.correo = 'laura.ospina@demo.test' limit 1) as cerrada_laura,
  (select id from public.perfiles where correo = 'laura.ospina@demo.test') as laura,
  (select id from public.perfiles where correo = 'mateo.restrepo@demo.test') as mateo,
  (select id from public.perfiles where correo = 'ana.gomez@demo.test') as ana,
  (select id from public.perfiles where correo = 'bruno.diaz@demo.test') as bruno,
  (select id from public.perfiles where correo = 'admin@demo.test') as admin
\gset

-- ---- Asesor -------------------------------------------------------------------------------

select pg_temp.como('laura.ospina@demo.test');
select pg_temp.vale('1 asesor ve todas', 'select count(*) from public.solicitudes', '40');
select pg_temp.filas('2 asesor toma un caso libre',
  format($q$update public.solicitudes set responsable_id = %L where id = %L and responsable_id is null$q$, :'laura', :'libre1'), 1);
-- conteos_bandeja() debe dar lo mismo que los conteos por separado que reemplaza.
select pg_temp.vale('3c conteos_bandeja: pendientes',
  $q$select (select pendiente from public.conteos_bandeja()) = (select count(*) from public.solicitudes where estado = 'pendiente')$q$, 'true');
select pg_temp.vale('3d conteos_bandeja: mías con filtro de tipo',
  $q$select (select mias from public.conteos_bandeja(p_tipo => 'supletorio')) = (select count(*) from public.solicitudes where responsable_id = auth.uid() and tipo = 'supletorio')$q$, 'true');
select pg_temp.vale('3e conteos_bandeja: libres ignora el filtro de responsable',
  $q$select (select libres from public.conteos_bandeja(p_responsable => auth.uid())) = (select count(*) from public.solicitudes where responsable_id is null and estado in ('pendiente', 'en_proceso'))$q$, 'true');
select pg_temp.vale('3f conteos_bandeja: pestaña respeta el responsable',
  $q$select (select en_proceso from public.conteos_bandeja(p_responsable => auth.uid(), p_estado => 'pendiente')) = (select count(*) from public.solicitudes where responsable_id = auth.uid() and estado = 'en_proceso')$q$, 'true');
select pg_temp.vale('3 asesor no ve métricas', 'select count(*) from public.carga_por_asesor', '0');
select pg_temp.vale('3b asesor no ve métricas', 'select count(*) from public.metricas_por_estado', '0');
select pg_temp.falla('4 asesor no reabre',
  format($q$update public.solicitudes set estado = 'en_proceso', observaciones = 'x' where id = %L$q$, :'cerrada_laura'),
  'Solo un administrador puede reabrir');
select pg_temp.falla('5 asesor no cambia roles',
  format($q$select public.cambiar_rol(%L, 'asesor')$q$, :'ana'), 'Solo un administrador');
-- Tocar un caso libre lo toma.
select pg_temp.filas('6 mover un caso libre lo toma',
  format($q$update public.solicitudes set estado = 'en_proceso' where id = %L$q$, :'libre2'), 1);
select pg_temp.vale('6b quedó como responsable',
  format($q$select responsable_id from public.solicitudes where id = %L$q$, :'libre2'), :'laura');

select pg_temp.como('mateo.restrepo@demo.test');
select pg_temp.filas('7 otro asesor no puede tomarlo',
  format($q$update public.solicitudes set responsable_id = %L where id = %L and responsable_id is null$q$, :'mateo', :'libre1'), 0);
select pg_temp.filas('8 otro asesor no puede moverlo',
  format($q$update public.solicitudes set estado = 'en_proceso' where id = %L$q$, :'libre1'), 0);
select pg_temp.filas('9 otro asesor no puede clasificarlo',
  format($q$update public.solicitudes set tipo = 'otro' where id = %L$q$, :'libre1'), 0);
select pg_temp.filas('10 asesor gestiona lo suyo',
  format($q$update public.solicitudes set estado = 'finalizada', observaciones = 'Listo' where id = %L$q$, :'de_mateo'), 1);
select pg_temp.vale('10b cerrar guarda la fecha de cierre',
  format($q$select (cerrada is not null)::text from public.solicitudes where id = %L$q$, :'de_mateo'), 'true');
select pg_temp.falla('11 asesor no reasigna',
  format($q$update public.solicitudes set responsable_id = %L where id = %L$q$, :'laura', :'de_mateo'),
  'Solo un administrador puede reasignar');
select pg_temp.falla('12 asesor no libera',
  format($q$update public.solicitudes set responsable_id = null where id = %L$q$, :'de_mateo'),
  'Solo un administrador puede reasignar');
select pg_temp.falla('13 retiro de la coordinación exige observación',
  format($q$update public.solicitudes set estado = 'retirada' where id = %L$q$, :'de_ana'),
  'Registrar un retiro exige una observación');

-- ---- Admin --------------------------------------------------------------------------------

select pg_temp.como('admin@demo.test');
select pg_temp.vale('14 admin ve la carga de cada asesor', 'select count(*) from public.carga_por_asesor', '3');
select pg_temp.filas('15 admin reasigna',
  format($q$update public.solicitudes set responsable_id = %L where id = %L$q$, :'mateo', :'libre1'), 1);
select pg_temp.falla('16 el responsable debe ser personal',
  format($q$update public.solicitudes set responsable_id = %L where id = %L$q$, :'bruno', :'libre1'),
  'debe ser un asesor o un administrador');
select pg_temp.falla('16b el responsable no es el mismo estudiante',
  format($q$update public.solicitudes set responsable_id = %L where id = %L$q$, :'ana', :'libre1'),
  'no puede ser el mismo estudiante');
select pg_temp.filas('17 admin libera',
  format($q$update public.solicitudes set responsable_id = null where id = %L$q$, :'libre1'), 1);
select pg_temp.falla('18 reabrir exige observación',
  format($q$update public.solicitudes set estado = 'en_proceso' where id = %L$q$, :'cerrada_laura'),
  'Reabrir una solicitud exige una observación');
select pg_temp.filas('19 admin reabre',
  format($q$update public.solicitudes set estado = 'en_proceso', observaciones = 'Se revisa de nuevo' where id = %L$q$, :'cerrada_laura'), 1);
select pg_temp.vale('19b la reapertura queda en el historial',
  format($q$select count(*) from public.historial_estados where solicitud_id = %L and estado_anterior = 'finalizada' and estado_nuevo = 'en_proceso'$q$, :'cerrada_laura'), '1');
select pg_temp.vale('19d reabrir borra la fecha de cierre',
  format($q$select (cerrada is null)::text from public.solicitudes where id = %L$q$, :'cerrada_laura'), 'true');
select pg_temp.vale('19c reabrir conserva el responsable',
  format($q$select responsable_id from public.solicitudes where id = %L$q$, :'cerrada_laura'), :'laura');
select pg_temp.falla('20 no se promueve a admin desde la app',
  format($q$select public.cambiar_rol(%L, 'admin')$q$, :'ana'), 'solo se asigna directamente');
select pg_temp.falla('21 nadie cambia su propio rol',
  format($q$select public.cambiar_rol(%L, 'estudiante')$q$, :'admin'), 'No puedes cambiar tu propio rol');
select pg_temp.falla('22 no se degrada un asesor con casos abiertos',
  format($q$select public.cambiar_rol(%L, 'estudiante')$q$, :'laura'), 'Reasigna primero');
select pg_temp.filas('23 admin promueve a asesor', format($q$select public.cambiar_rol(%L, 'asesor')$q$, :'ana'), 1);

-- ---- Estudiante promovido a asesor ----------------------------------------------------------

select pg_temp.como('ana.gomez@demo.test');
-- La política de retiro del estudiante le deja alcanzar la fila; el trigger la rechaza.
select pg_temp.falla('24 no toma una solicitud propia',
  format($q$update public.solicitudes set responsable_id = %L where id = %L and responsable_id is null$q$, :'ana', :'de_ana'),
  'registraste tú');
select pg_temp.falla('25 el personal no registra solicitudes',
  $q$insert into public.solicitudes (tipo, asunto, descripcion) values ('otro', 'Prueba', 'Prueba de permisos')$q$,
  'row-level security');

-- ---- Estudiante ---------------------------------------------------------------------------

select pg_temp.como('bruno.diaz@demo.test');
select pg_temp.vale('26 el estudiante solo ve lo suyo',
  $q$select count(*) filter (where estudiante_id <> auth.uid()) from public.solicitudes$q$, '0');
select pg_temp.vale('27 el estudiante no ve perfiles ajenos', 'select count(*) from public.perfiles', '1');
select pg_temp.vale('28 el estudiante no ve métricas', 'select count(*) from public.carga_por_asesor', '0');
select pg_temp.falla('29 el estudiante no cambia roles',
  format($q$select public.cambiar_rol(%L, 'asesor')$q$, :'ana'), 'Solo un administrador');

reset role;
rollback;

\o
\echo prueba-roles: ok
