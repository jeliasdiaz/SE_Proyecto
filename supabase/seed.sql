-- ============================================================================================
-- DATOS DE PRUEBA SOLO PARA SUPABASE LOCAL (`supabase db reset`).
-- Las contraseñas están en este archivo, que es público en Git. NUNCA subirlo a la nube
-- (no usar `db push --include-seed`): cualquiera podría entrar como admin.
-- Todos los datos son sintéticos (R6).
--
-- Usuarios (contraseña de todos: Demo12345):
--   admin@demo.test        administrador
--   laura.ospina@demo.test asesora
--   mateo.restrepo@demo.test asesor
--   ana.gomez@demo.test    estudiante
--   bruno.diaz@demo.test   estudiante
--   carla.rios@demo.test   estudiante
--   diego.mora@demo.test   estudiante
-- ============================================================================================

-- Usuarios confirmados: el trigger al_confirmar_correo crea su perfil.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
select
  '00000000-0000-0000-0000-000000000000',
  u.id,
  'authenticated',
  'authenticated',
  u.email,
  extensions.crypt('Demo12345', extensions.gen_salt('bf')),
  now() - interval '60 days',
  '{"provider": "email", "providers": ["email"]}',
  jsonb_build_object('nombre', u.nombre, 'id_estudiantil', u.id_estudiantil),
  now() - interval '60 days',
  now() - interval '60 days',
  '', '', '', ''
from (values
  ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@demo.test', 'Coordinación Académica', null),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'laura.ospina@demo.test', 'Laura Ospina', null),
  ('00000000-0000-4000-a000-000000000003'::uuid, 'mateo.restrepo@demo.test', 'Mateo Restrepo', null),
  ('00000000-0000-4000-a000-000000000011'::uuid, 'ana.gomez@demo.test', 'Ana Gómez', '100001'),
  ('00000000-0000-4000-a000-000000000012'::uuid, 'bruno.diaz@demo.test', 'Bruno Díaz', '100002'),
  ('00000000-0000-4000-a000-000000000013'::uuid, 'carla.rios@demo.test', 'Carla Ríos', '100003'),
  ('00000000-0000-4000-a000-000000000014'::uuid, 'diego.mora@demo.test', 'Diego Mora', '100004')
) as u (id, email, nombre, id_estudiantil);

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  u.id::text,
  u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email',
  now(),
  now(),
  now()
from auth.users u
where u.email like '%@demo.test';

-- El rol de admin solo se asigna por SQL.
update public.perfiles set rol = 'admin' where correo = 'admin@demo.test';
update public.perfiles set rol = 'asesor' where correo in ('laura.ospina@demo.test', 'mateo.restrepo@demo.test');

-- 40 solicitudes (R11) con historial en fechas pasadas. Los triggers se desactivan para poder
-- fechar el historial; por eso aquí se escriben a mano las mismas filas que ellos generarían.
alter table public.solicitudes disable trigger user;

do $$
declare
  v_admin uuid := '00000000-0000-4000-a000-000000000001';
  v_asesores uuid[] := array[
    '00000000-0000-4000-a000-000000000002',
    '00000000-0000-4000-a000-000000000003'
  ]::uuid[];
  v_responsable uuid;
  v_estudiantes uuid[] := array[
    '00000000-0000-4000-a000-000000000011',
    '00000000-0000-4000-a000-000000000012',
    '00000000-0000-4000-a000-000000000013',
    '00000000-0000-4000-a000-000000000014'
  ]::uuid[];
  v_tipos public.tipo_solicitud[] := array[
    'homologacion', 'cancelacion_extemporanea', 'supletorio', 'reingreso', 'comite_curricular',
    'homologacion', 'supletorio', 'cancelacion_extemporanea', 'comite_curricular', 'otro'
  ]::public.tipo_solicitud[];
  v_notas_rechazo text[] := array[
    'No se adjuntó el soporte requerido (certificado de notas o constancia).',
    'La solicitud se presentó fuera del plazo establecido por el reglamento.',
    'El caso no cumple las condiciones del reglamento estudiantil para este trámite.'
  ];
  v_notas_aprobacion text[] := array[
    'Solicitud aprobada. La decisión quedó registrada en el sistema académico.',
    'Aprobada por el comité. Revisa tu plan de estudios actualizado.',
    'Trámite completado. No se requiere ninguna acción adicional de tu parte.'
  ];
  i integer;
  v_id uuid;
  v_estudiante uuid;
  v_tipo public.tipo_solicitud;
  v_estado public.estado_solicitud;
  v_origen public.origen_solicitud;
  v_revision public.estado_revision;
  v_motivo text;
  v_asuntos text[];
  v_asunto text;
  v_factor integer;
  v_creada timestamptz;
  v_atencion timestamptz;
  v_cierre timestamptz;
  v_actualizada timestamptz;
  v_nota text;
  v_rechazo_directo boolean;
begin
  for i in 1..40 loop
    v_id := gen_random_uuid();
    v_estudiante := v_estudiantes[(i % 4) + 1];
    v_tipo := v_tipos[(i % 10) + 1];
    v_estado := case
      when (i * 7) % 10 in (0, 1, 2) then 'pendiente'
      when (i * 7) % 10 in (3, 4) then 'en_proceso'
      when (i * 7) % 10 in (5, 6, 7) then 'finalizada'
      else 'rechazada'
    end;
    v_origen := case when i % 5 = 0 then 'correo' else 'web' end;
    v_revision := 'ok';
    v_motivo := null;

    if v_origen = 'correo' and v_estado = 'pendiente' and i % 20 = 0 then
      v_tipo := 'otro';
      v_revision := 'por_revisar';
      v_motivo := 'No se pudo identificar el tipo de trámite en el correo.';
    end if;

    v_asuntos := case v_tipo
      when 'homologacion' then array[
        'Homologación de Cálculo Diferencial',
        'Homologación de materias cursadas en intercambio',
        'Homologación de Programación I desde otra universidad']
      when 'cancelacion_extemporanea' then array[
        'Cancelación extemporánea de Física Mecánica por incapacidad médica',
        'Cancelación extemporánea de Estadística',
        'Cancelación de asignatura por calamidad doméstica']
      when 'supletorio' then array[
        'Supletorio del parcial 2 de Bases de Datos',
        'Supletorio del examen final de Álgebra Lineal',
        'Supletorio por cita médica el día del parcial']
      when 'reingreso' then array[
        'Solicitud de reingreso para el semestre 2026-2',
        'Reingreso tras aplazamiento de semestre']
      when 'comite_curricular' then array[
        'Solicitud al comité curricular: cambio de énfasis',
        'Aprobación de práctica empresarial fuera de fecha',
        'Excepción de prerrequisito para Sistemas Empresariales']
      else array[
        'Consulta sobre mi situación académica',
        'Solicitud enviada por correo sin asunto claro']
    end;
    v_asunto := v_asuntos[(i % array_length(v_asuntos, 1)) + 1];

    -- Horas extra por tipo para que las métricas muestren diferencias entre trámites.
    v_factor := case v_tipo
      when 'supletorio' then 0
      when 'cancelacion_extemporanea' then 12
      when 'reingreso' then 24
      when 'otro' then 36
      when 'homologacion' then 48
      else 72
    end;

    v_rechazo_directo := v_estado = 'rechazada' and i % 2 = 0;

    -- Los casos atendidos se reparten entre los asesores (y alguno el admin). De los pendientes,
    -- un tercio ya lo tomó un asesor sin moverlo; el resto sigue libre en la bandeja.
    v_responsable := case
      when v_estado <> 'pendiente' and i % 7 = 0 then v_admin
      when v_estado <> 'pendiente' or i % 3 = 0 then v_asesores[(i % 2) + 1]
    end;
    v_atencion := null;
    v_cierre := null;
    v_nota := null;

    if v_estado in ('finalizada', 'rechazada') then
      v_creada := now() - make_interval(days => 15 + (i * 11) % 30, hours => (i * 5) % 24);
      v_atencion := v_creada + make_interval(hours => 2 + (i * 13) % 48 + v_factor);
      if v_rechazo_directo then
        v_cierre := v_atencion;
        v_atencion := null;
      else
        v_cierre := v_atencion + make_interval(hours => 12 + (i * 29) % 96 + v_factor);
      end if;
      v_nota := case v_estado
        when 'finalizada' then v_notas_aprobacion[(i % 3) + 1]
        else v_notas_rechazo[(i % 3) + 1]
      end;
      v_actualizada := v_cierre;
    elsif v_estado = 'en_proceso' then
      v_creada := now() - make_interval(days => 2 + (i * 3) % 12);
      v_atencion := v_creada + make_interval(hours => 2 + (i * 13) % 30);
      v_nota := case when i % 2 = 0 then 'En revisión por la coordinación.' end;
      v_actualizada := v_atencion;
    else
      v_creada := now() - make_interval(days => (i * 17) % 9, hours => 1 + (i * 7) % 20);
      v_actualizada := v_creada;
    end if;

    insert into public.solicitudes (
      id, estudiante_id, tipo, asunto, descripcion, estado, observaciones, origen, revision,
      motivo_revision, responsable_id, creada, actualizada
    ) values (
      v_id,
      v_estudiante,
      v_tipo,
      v_asunto,
      format(
        'Buenas tardes. Escribo para presentar la siguiente solicitud: %s. '
        'Adjunto los soportes que tengo disponibles y quedo atento a cualquier documento adicional. Gracias.',
        lower(v_asunto)
      ),
      v_estado,
      v_nota,
      v_origen,
      v_revision,
      v_motivo,
      v_responsable,
      v_creada,
      v_actualizada
    );

    insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha)
    values (v_id, null, 'pendiente', null, case when v_origen = 'web' then v_estudiante end, v_creada);

    if v_atencion is not null then
      insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha)
      values (
        v_id, 'pendiente', 'en_proceso',
        case when v_estado = 'en_proceso' then v_nota end,
        v_responsable, v_atencion
      );
    end if;

    if v_cierre is not null then
      insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha)
      values (
        v_id,
        case when v_rechazo_directo then 'pendiente' else 'en_proceso' end::public.estado_solicitud,
        v_estado, v_nota, v_responsable, v_cierre
      );
    end if;
  end loop;
end;
$$;

alter table public.solicitudes enable trigger user;
