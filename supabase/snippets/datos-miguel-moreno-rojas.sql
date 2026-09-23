-- Datos de demostracion para Miguel Moreno Rojas.
-- Ejecutar en el SQL Editor del proyecto de Supabase.
-- Se busca por ID estudiantil para no depender de un correo escrito a mano.

do $$
declare
  v_estudiante uuid;
begin
  select id
    into v_estudiante
  from public.perfiles
  where id_estudiantil = '000554286'
    and rol = 'estudiante';

  if v_estudiante is null then
    raise exception 'No existe un perfil de estudiante confirmado con ID %',
      '000554286';
  end if;

  insert into public.solicitudes (
    estudiante_id, tipo, asunto, descripcion, estado, observaciones, origen, revision,
    creada, actualizada
  )
  select
    v_estudiante,
    datos.tipo::public.tipo_solicitud,
    datos.asunto,
    datos.descripcion,
    datos.estado::public.estado_solicitud,
    datos.observaciones,
    'web'::public.origen_solicitud,
    'ok'::public.estado_revision,
    now() - datos.dias_anteriores * interval '1 day',
    now() - datos.dias_anteriores * interval '1 day'
  from (
    values
      (
        'homologacion',
        'Homologacion de asignatura cursada anteriormente',
        'Solicito revisar la homologacion de una asignatura cursada anteriormente. Adjunto los soportes academicos correspondientes.',
        'finalizada',
        'Solicitud aprobada. La decision quedo registrada en el sistema academico.',
        18
      ),
      (
        'supletorio',
        'Solicitud de examen supletorio',
        'Solicito autorizacion para presentar el examen supletorio. Tuve una situacion personal que me impidio asistir a la fecha original.',
        'en_proceso',
        'En revision por la coordinacion academica.',
        4
      ),
      (
        'cancelacion_extemporanea',
        'Cancelacion extemporanea de asignatura',
        'Solicito estudiar la cancelacion extemporanea de una asignatura por motivos personales. Quedo atento a los documentos adicionales requeridos.',
        'pendiente',
        null,
        1
      ),
      (
        'reingreso',
        'Solicitud de reingreso para el proximo semestre',
        'Solicito informacion y tramite de reingreso para el proximo semestre academico.',
        'rechazada',
        'El caso no cumple las condiciones del reglamento estudiantil para este tramite.',
        30
      )
  ) as datos(tipo, asunto, descripcion, estado, observaciones, dias_anteriores)
  where not exists (
    select 1
    from public.solicitudes existente
    where existente.estudiante_id = v_estudiante
      and existente.asunto = datos.asunto
  );
end;
$$;

-- Comprobacion rapida: debe devolver las solicitudes creadas para Miguel.
select tipo, asunto, estado, creada
from public.solicitudes
where estudiante_id = (
  select id
  from public.perfiles
  where id_estudiantil = '000554286'
)
order by creada desc;
