-- ============================================================================================
-- DATOS DE PRUEBA "ORGÁNICOS" PARA EL PROYECTO EN LA NUBE. Se corre UNA vez, a mano, en el SQL
-- Editor, sobre una base sin solicitudes (vaciarla: docs/plan-qa-demo.md). Reemplaza a
-- seed-nube.sql cuando se quiere que la demo parezca un sistema en uso.
--
-- Antes de correrlo:
--   1. Deben existir el admin y los asesores reales (ver seed-nube.sql, pasos 1 a 4).
--   2. (Opcional) Escribe en c_estudiante_demo el correo de la cuenta real del estudiante de la
--      demo: recibe 3 solicitudes antiguas para que "Mis solicitudes" no esté vacío (y su perfil
--      queda fechado antes de la primera).
--
-- Qué genera (c_semanas, c_solicitudes y c_estudiantes se cambian abajo):
--   - c_estudiantes estudiantes sintéticos (@demo.test, contraseña aleatoria: nadie entra con ellos
--     y no reciben correos). Unos pocos hacen muchas solicitudes y la mayoría pocas.
--   - c_solicitudes solicitudes en las últimas c_semanas semanas, con la temporada de un semestre:
--     homologaciones y reingresos al inicio, supletorios tras cada ronda de parciales,
--     cancelaciones hacia la fecha límite. Más volumen entre semana y en horario de oficina.
--   - Cada caso se simula en orden cronológico con las reglas de la base: se asigna como
--     asignar_responsable() (el asesor con menos casos abiertos en ese momento), solo usa
--     transiciones permitidas, el personal actúa de lunes a viernes de 8:00 a 18:00, cada asesor
--     tiene su ritmo y el comité curricular decide los jueves. Hay retiros, rechazos con motivo,
--     reaperturas del admin, correos con el trámite sin identificar y casos estancados (F3).
--   - El historial y las filas de avisos_enviados que F1, F2, F3 y F4 habrían registrado.
-- No genera adjuntos: el SQL no puede crear archivos en Storage.
--
-- Todo es sintético (R6) y reproducible: misma semilla, mismos datos. Va en una sola transacción
-- y con los triggers apagados mientras inserta: no dispara los Database Webhooks (ningún correo).
-- Para quitarlo: supabase/snippets/limpiar-seed-organico.sql.
-- ============================================================================================

begin;

-- Auxiliares de esta sesión: pg_temp desaparece al cerrar la conexión. Todas usan random(), que
-- sigue la semilla que fija el bloque principal.

create function pg_temp.uno(opciones text[]) returns text
language sql volatile as $f$
  select opciones[1 + floor(random() * array_length(opciones, 1))::integer]
$f$;

create function pg_temp.uno(opciones jsonb) returns text
language sql volatile as $f$
  select opciones ->> floor(random() * jsonb_array_length(opciones))::integer
$f$;

-- Índice (desde 1) elegido con probabilidad proporcional a su peso.
create function pg_temp.ponderado(pesos numeric[]) returns integer
language plpgsql volatile as $f$
declare
  v_total numeric := 0;
  v_x numeric;
begin
  for i in 1 .. array_length(pesos, 1) loop
    v_total := v_total + pesos[i];
  end loop;
  v_x := random() * v_total;
  for i in 1 .. array_length(pesos, 1) loop
    v_x := v_x - pesos[i];
    if v_x < 0 then
      return i;
    end if;
  end loop;
  return array_length(pesos, 1);
end;
$f$;

-- Factor log-normal de mediana 1: tiempos con cola larga, como los de verdad.
create function pg_temp.ruido(dispersion double precision) returns double precision
language sql volatile as $f$
  select exp(dispersion * sqrt(-2 * ln(1 - random())) * cos(2 * pi() * random()))
$f$;

-- El personal trabaja de lunes a viernes de 8:00 a 18:00 (hora de Colombia). Lo que caería fuera
-- de ese horario pasa al siguiente día hábil, entre las 8:00 y las 9:30.
create function pg_temp.laboral(t timestamptz) returns timestamptz
language plpgsql volatile as $f$
declare
  v_local timestamp := t at time zone 'America/Bogota';
  v_dia date := (t at time zone 'America/Bogota')::date;
begin
  if extract(isodow from v_local) <= 5 and v_local::time >= '08:00' and v_local::time < '18:00' then
    return t;
  end if;
  if extract(isodow from v_local) > 5 or v_local::time >= '18:00' then
    v_dia := v_dia + 1;
  end if;
  while extract(isodow from v_dia) > 5 loop
    v_dia := v_dia + 1;
  end loop;
  return (v_dia + time '08:00' + make_interval(mins => floor(random() * 90)::integer)) at time zone 'America/Bogota';
end;
$f$;

-- Primera ejecución programada de F3 (todos los días a las 8:00) en t o después.
create function pg_temp.ocho_am(t timestamptz) returns timestamptz
language sql immutable as $f$
  select (
    (t at time zone 'America/Bogota')::date
    + case when (t at time zone 'America/Bogota')::time <= '08:00' then 0 else 1 end
    + time '08:00'
  ) at time zone 'America/Bogota'
$f$;

create function pg_temp.rellenar(plantilla text, valores jsonb) returns text
language plpgsql immutable as $f$
declare
  v_texto text := plantilla;
  v_clave text;
begin
  for v_clave in select jsonb_object_keys(valores) loop
    v_texto := replace(v_texto, '{' || v_clave || '}', valores ->> v_clave);
  end loop;
  return v_texto;
end;
$f$;

create temporary table seed_alumnos (
  id uuid primary key,
  nombre text not null,
  correo text not null,
  codigo text,
  peso numeric not null,
  demo boolean not null
) on commit drop;

create temporary table seed_asesores (
  id uuid primary key,
  ritmo numeric not null
) on commit drop;

create temporary table seed_llegadas (
  creada timestamptz not null,
  tipo public.tipo_solicitud not null,
  origen public.origen_solicitud not null,
  alumno uuid not null,
  -- Correo en el que F4 no identifica el trámite: llega como "otro" hasta que el asesor lo corrige.
  ambigua boolean not null,
  -- Resultado fijo para las solicitudes del estudiante de la demo.
  forzado public.estado_solicitud
) on commit drop;

-- Para calcular la carga de cada asesor en cada momento, como asignar_responsable().
create temporary table seed_casos (
  id uuid primary key,
  responsable uuid,
  creada timestamptz not null,
  fin timestamptz
) on commit drop;

create temporary table seed_eventos (
  solicitud_id uuid not null,
  fecha timestamptz not null,
  anterior public.estado_solicitud,
  nuevo public.estado_solicitud not null,
  observacion text,
  usuario uuid
) on commit drop;

do $$
declare
  -- ===== Configuración =====
  c_estudiante_demo constant text := '';  -- p. ej. 'estudiante.demo@gmail.com'; vacío: ninguno
  c_semanas constant integer := 8;
  c_solicitudes constant integer := 120;
  c_estudiantes constant integer := 16;    -- hasta 40
  c_semilla constant double precision := 0.2026;

  v_ahora timestamptz := now();
  v_dias integer := c_semanas * 7;
  v_dia0 date := (now() at time zone 'America/Bogota')::date - c_semanas * 7 + 1;
  v_admin uuid;
  v_demo uuid;
  v_semestre text;

  v_tipos public.tipo_solicitud[] := array[
    'homologacion', 'cancelacion_extemporanea', 'supletorio', 'reingreso', 'comite_curricular', 'otro'
  ]::public.tipo_solicitud[];
  -- Peso de cada trámite (en el orden de v_tipos) en cada octavo del periodo, del más antiguo al actual.
  v_temporada numeric[] := array[
    [5, 4, 2, 1, 1, 1, 0.5, 0.5],
    [0.3, 0.5, 1, 2, 3, 4, 3, 1],
    [0.5, 1, 4, 3, 1, 1, 4, 3],
    [3, 2, 1, 0.5, 0.5, 0.5, 1, 1.5],
    [2, 2, 2, 2, 2, 2, 2, 2],
    [0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]
  ];
  v_peso_dia numeric[] := array[1.3, 1.2, 1.15, 1.05, 0.9, 0.25, 0.15];  -- lunes a domingo
  v_peso_hora numeric[] := array[
    0.1, 0.05, 0.02, 0.02, 0.02, 0.05, 0.3, 0.8, 1.6, 2.0, 2.1, 1.8,
    1.1, 1.2, 1.7, 1.9, 1.7, 1.4, 1.1, 1.2, 1.4, 1.3, 0.8, 0.4
  ];
  -- Mediana en horas por tipo, antes de aplicar el ritmo del asesor. El comité va por sesiones.
  v_horas_atencion numeric[] := array[44, 26, 12, 34, 40, 30];
  v_horas_resolucion numeric[] := array[110, 64, 30, 90, 0, 40];
  v_prob_rechazo numeric[] := array[0.12, 0.25, 0.08, 0.10, 0.20, 0.15];
  v_ritmos numeric[] := array[0.85, 1.0, 1.3, 1.1, 0.9, 1.2];

  v_nombres text[] := array[
    'Valentina Arango', 'Juan Pablo Ochoa', 'Mariana Cardona', 'Sebastián Henao', 'Isabella Montoya',
    'Samuel Correa', 'Daniela Zapata', 'Tomás Giraldo', 'Sara Londoño', 'Emiliano Quintero',
    'Luciana Betancur', 'Jerónimo Agudelo', 'Manuela Posada', 'Nicolás Uribe', 'Antonia Villegas',
    'Martín Salazar', 'Gabriela Echeverri', 'Alejandro Ruiz', 'Camila Toro', 'Felipe Álvarez',
    'Juliana Mesa', 'David Hoyos', 'María José Patiño', 'Esteban Jaramillo', 'Catalina Builes',
    'Andrés Galeano', 'Paula Marín', 'Simón Castaño', 'Ana María Bedoya', 'Julián Serna',
    'Natalia Vargas', 'Kevin Muñoz', 'Melissa Cano', 'Brayan Osorio', 'Verónica Tobón',
    'Cristian Duque', 'Alejandra Rendón', 'Óscar Pineda', 'Luisa Fernanda Gil', 'Daniel Escobar'
  ];

  v_materias text[] := array[
    'Cálculo Diferencial', 'Cálculo Integral', 'Álgebra Lineal', 'Física Mecánica',
    'Probabilidad y Estadística', 'Programación I', 'Programación Orientada a Objetos',
    'Estructuras de Datos', 'Bases de Datos', 'Contabilidad Financiera', 'Microeconomía',
    'Macroeconomía', 'Gestión de Procesos de Negocio', 'Ingeniería de Requisitos',
    'Investigación de Operaciones', 'Sistemas de Información Empresarial', 'Arquitectura Empresarial',
    'Gerencia de Proyectos', 'Finanzas Corporativas', 'Analítica de Datos'
  ];
  v_motivos jsonb := jsonb_build_object(
    'supletorio', jsonb_build_array(
      'una incapacidad médica de tres días', 'una cita médica que no pude reprogramar',
      'una calamidad doméstica', 'un accidente de tránsito', 'un cuadro de dengue',
      'una cirugía programada', 'un problema familiar grave'),
    'cancelacion_extemporanea', jsonb_build_array(
      'problemas de salud', 'un traslado laboral a otra ciudad',
      'una situación económica difícil en mi familia', 'una incapacidad prolongada',
      'el cuidado de un familiar enfermo', 'un cambio de horario en mi trabajo')
  );
  v_instituciones text[] := array[
    'la Universidad Nacional', 'la Universidad de Antioquia', 'EAFIT',
    'el Politécnico Jaime Isaza Cadavid', 'el ITM', 'la Universidad de Medellín', 'el SENA'
  ];

  -- Para comité y "otro" el asunto y el cuerpo van en pareja; para los demás se combinan.
  v_asuntos_web jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array(
      'Homologación de {materia}', 'Homologación de {materia} cursada en {institucion}',
      'Solicitud de homologación: {materia}', 'Homologar {materia}'),
    'cancelacion_extemporanea', jsonb_build_array(
      'Cancelación extemporánea de {materia}', 'Cancelación fuera de fecha de {materia}',
      'Solicitud de cancelación extemporánea: {materia}'),
    'supletorio', jsonb_build_array(
      'Supletorio del parcial de {materia}', 'Solicitud de supletorio: {materia}',
      'Examen supletorio de {materia}', 'Supletorio {materia}'),
    'reingreso', jsonb_build_array(
      'Solicitud de reingreso', 'Reingreso para {semestre}', 'Reingreso al programa de Sistemas Empresariales')
  );
  v_asuntos_correo jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array('homologación {materia}', 'Solicitud homologación', 'Homologar materia de {institucion}'),
    'cancelacion_extemporanea', jsonb_build_array('Cancelación {materia}', 'cancelar materia fuera de fecha', 'Solicitud cancelación extemporánea'),
    'supletorio', jsonb_build_array('supletorio {materia}', 'Solicitud supletorio', 'Supletorio parcial'),
    'reingreso', jsonb_build_array('Reingreso', 'Solicitud de reingreso {semestre}', 'Quiero volver al programa')
  );
  v_asuntos_ambiguos text[] := array['Consulta', 'Solicitud', 'Ayuda con un trámite', 'Información por favor', 'Duda'];
  v_cuerpos jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array(
      'Solicito la homologación de {materia}, que cursé y aprobé en {institucion}. Adjunto el certificado de notas y el contenido programático.',
      'Vengo de {institucion} y quisiera homologar {materia}. La aprobé con 4,2 y el contenido es muy parecido al de aquí.',
      'Pido que me homologuen {materia}. La vi en {institucion} en 2025 y tengo el programa de la asignatura firmado por la universidad.',
      'Hice transferencia desde {institucion} y me falta homologar {materia}. ¿Qué documentos necesitan además del certificado de notas?',
      'En la homologación inicial no quedó incluida {materia}, que aprobé en {institucion}. Solicito que la revisen.',
      'Quisiera saber si puedo homologar {materia} con un curso equivalente que hice en {institucion}. Envío el certificado.'),
    'cancelacion_extemporanea', jsonb_build_array(
      'Solicito la cancelación extemporánea de {materia}. Por {motivo} no he podido asistir desde la semana 5 y no alcancé a cancelar en la fecha del calendario.',
      'Quisiera cancelar {materia} aunque ya pasó la fecha límite. El motivo es {motivo} y tengo cómo soportarlo.',
      'Pido cancelar {materia} fuera de fecha debido a {motivo}. Si la mantengo inscrita voy a perderla por fallas.',
      'Respetados señores: por {motivo} me resulta imposible continuar con {materia} este semestre. Solicito la cancelación extemporánea sin que afecte mi promedio.',
      '¿Todavía es posible cancelar {materia}? Por {motivo} me atrasé bastante. Adjunto los soportes.',
      'Necesito cancelar {materia}. No lo hice a tiempo porque esperaba ponerme al día, pero por {motivo} no fue posible.'),
    'supletorio', jsonb_build_array(
      'No pude presentar el parcial de {materia} por {motivo}. Adjunto el soporte y solicito que me programen el supletorio.',
      'Solicito examen supletorio de {materia}. El día del parcial tuve {motivo} y no alcancé a avisarle al docente con anticipación.',
      'Me perdí el segundo parcial de {materia} por {motivo}. ¿Es posible presentarlo en otra fecha? Tengo la constancia.',
      'Les escribo para pedir el supletorio del parcial de {materia}. Tuve {motivo}; el docente me dijo que debía radicar la solicitud por este medio.',
      'Por {motivo} no asistí al examen de {materia}. Solicito presentarlo como supletorio; tengo las demás notas al día.',
      'Necesito el supletorio de {materia}: el día del parcial tuve {motivo}.',
      'Solicito supletorio del quiz final de {materia}. Adjunto la incapacidad expedida por la EPS.',
      'El día del parcial de {materia} tuve {motivo}. Pido que me permitan presentarlo en la fecha de supletorios.'),
    'reingreso', jsonb_build_array(
      'Solicito el reingreso al programa de Sistemas Empresariales para el semestre {semestre}. Aplacé el semestre pasado por motivos laborales.',
      'Estuve por fuera un año por razones económicas y quiero volver en {semestre}. ¿Qué pasos debo seguir?',
      'Pido reingreso para {semestre}. Ya estoy a paz y salvo con la universidad y me faltan cuatro asignaturas para terminar.',
      'Me retiré en 2025-1 por salud y ya me recuperé. Quiero solicitar el reingreso para {semestre}.',
      'Solicito reingreso. Cancelé el semestre anterior por un traslado de ciudad y ya regresé a Medellín.',
      'Quiero retomar la carrera en {semestre}. Me faltan la práctica y dos materias del último nivel.')
  );
  v_pares jsonb := jsonb_build_object(
    'comite_curricular', jsonb_build_array(
      jsonb_build_array('Excepción de prerrequisito para {materia}',
        'Solicito al comité curricular una excepción de prerrequisito para cursar {materia} este semestre. Solo me falta ese prerrequisito y lo estoy viendo en paralelo.'),
      jsonb_build_array('Práctica empresarial fuera de fecha',
        'Pido aprobación para iniciar la práctica empresarial el próximo mes en una empresa de software de Medellín. La convocatoria salió después de las fechas del calendario académico.'),
      jsonb_build_array('Cambio de énfasis',
        'Quisiera cambiar mi énfasis a Analítica de Negocios. Ya cursé dos electivas de esa línea y me interesa más que el énfasis actual.'),
      jsonb_build_array('Cruce de horario con {materia}',
        'Solicito inscribir {materia} aunque tiene un cruce de una hora con otra asignatura. El docente está de acuerdo en que llegue a la segunda hora.'),
      jsonb_build_array('Créditos adicionales este semestre',
        'Pido autorización para matricular 22 créditos este semestre. Mi promedio acumulado es 4,1 y con esto podría graduarme a tiempo.'),
      jsonb_build_array('Validación por suficiencia de {materia}',
        'Solicito que el comité estudie la validación por suficiencia de {materia}. Trabajo hace dos años en el área y tengo certificaciones que lo respaldan.'),
      jsonb_build_array('Doble programa con Ingeniería Industrial',
        'Quiero iniciar doble programa con Ingeniería Industrial. ¿El comité puede estudiar mi caso? Llevo el 60 % de los créditos aprobados.')),
    'otro', jsonb_build_array(
      jsonb_build_array('Certificado de notas firmado',
        'Necesito un certificado de notas con firma de la coordinación para una beca. ¿Me lo pueden expedir?'),
      jsonb_build_array('Corrección de nota en {materia}',
        'En el portal me aparece 2,8 en {materia}, pero el docente me confirmó que la nota definitiva es 3,3. ¿Cómo se corrige?'),
      jsonb_build_array('Créditos que me faltan para graduarme',
        'Quisiera saber cuántos créditos me faltan para graduarme. En el portal no me queda claro qué electivas cuentan.'),
      jsonb_build_array('Prueba académica',
        'Quedé en prueba académica y no sé qué implica para el próximo semestre. ¿Me pueden orientar?'),
      jsonb_build_array('Carta con horario de clases',
        'Solicito una carta de la coordinación con mi horario de clases para presentarla en mi trabajo.'))
  );
  v_saludos text[] := array['Buenos días.', 'Buenas tardes.', 'Hola, buenas tardes.', 'Cordial saludo.', 'Buen día, coordinación.'];
  v_despedidas text[] := array[
    E'Muchas gracias.\n{nombre}',
    E'Quedo pendiente de su respuesta.\n{nombre}\nCódigo {codigo}',
    E'Gracias de antemano.\n{nombre_corto}',
    E'Saludos,\n{nombre}\n\nEnviado desde mi celular',
    E'Agradezco su ayuda.\n{nombre}\nSistemas Empresariales'
  ];

  v_notas_proceso jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array('Estamos comparando los contenidos con el programa de {materia}.', 'Pedimos el contenido programático firmado por la universidad de origen.'),
    'cancelacion_extemporanea', jsonb_build_array('Revisamos el soporte y tu asistencia en {materia}.', 'Pedimos concepto al docente de {materia}.'),
    'supletorio', jsonb_build_array('Revisando el soporte con el docente de {materia}.', 'Validamos la incapacidad con Bienestar Universitario.'),
    'reingreso', jsonb_build_array('Verificamos tu estado financiero y tu historia académica.', 'Revisando el plan de estudios que te aplica.'),
    'comite_curricular', jsonb_build_array('El caso se presentará en la próxima sesión del comité curricular.', 'En estudio por el comité curricular.'),
    'otro', jsonb_build_array('Estamos revisando tu caso.', 'Lo consultamos con Admisiones y Registro.')
  );
  v_notas_aprobacion jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array('Homologación aprobada: {materia} quedó registrada en tu historia académica con la nota de origen.', 'Aprobada. La homologación se verá en el portal en las próximas 48 horas.'),
    'cancelacion_extemporanea', jsonb_build_array('Cancelación aprobada. {materia} ya no aparece en tu matrícula y no afecta tu promedio.', 'Aprobada la cancelación extemporánea de {materia}.'),
    'supletorio', jsonb_build_array('Supletorio aprobado. El docente de {materia} te escribirá para acordar la fecha.', 'Aprobado: presentas el supletorio el {fecha_examen} a las 10:00 a. m.', 'Supletorio autorizado y registrado en el sistema.'),
    'reingreso', jsonb_build_array('Reingreso aprobado para {semestre}. Ya puedes hacer la matrícula académica en las fechas del calendario.', 'Aprobado. Te asignamos el plan de estudios vigente; revisa tus equivalencias en el portal.'),
    'comite_curricular', jsonb_build_array('El comité curricular aprobó la solicitud en su sesión del {fecha}.', 'Aprobada por el comité curricular. El cambio ya quedó registrado en el sistema.'),
    'otro', jsonb_build_array('Listo: el documento quedó disponible en el portal.', 'Resuelto. Te enviamos la respuesta detallada por correo.', 'Atendido. Revisa el detalle en tu portal académico.')
  );
  v_notas_rechazo jsonb := jsonb_build_object(
    'homologacion', jsonb_build_array('Los contenidos de la asignatura cursada no cubren el 80 % del programa de {materia}.', 'La nota aprobatoria es inferior a 3,5, la mínima para homologar.', 'Han pasado más de cinco años desde que se cursó la asignatura.'),
    'cancelacion_extemporanea', jsonb_build_array('El reglamento solo permite la cancelación extemporánea por fuerza mayor y el soporte no la demuestra.', 'Ya presentaste el examen final de {materia}; no procede la cancelación.', 'El motivo no está entre las causas que contempla el reglamento para cancelar fuera de fecha.'),
    'supletorio', jsonb_build_array('La incapacidad no cubre la fecha del parcial de {materia}.', 'La solicitud llegó después de los tres días hábiles que da el reglamento para pedir supletorio.', 'El soporte no corresponde a una causa justificada según el reglamento estudiantil.'),
    'reingreso', jsonb_build_array('Tienes un saldo pendiente con la universidad; cuando estés a paz y salvo puedes volver a presentar la solicitud.', 'El plan de estudios cambió y primero debes solicitar el estudio de equivalencias.'),
    'comite_curricular', jsonb_build_array('El comité no aprobó la solicitud: no cumple los requisitos del reglamento para este caso.', 'El comité no la autorizó por ahora; puedes presentarla de nuevo el próximo semestre.', 'El comité no aprobó la solicitud porque la documentación llegó incompleta.'),
    'otro', jsonb_build_array('Este trámite no lo gestiona la coordinación: solicítalo en Admisiones y Registro.', 'No es posible atenderla por este medio; acércate a la oficina de la coordinación.')
  );
  v_rechazos_directos text[] := array[
    'Falta el soporte requerido. Vuelve a radicar la solicitud adjuntándolo.',
    'Ya tienes una solicitud igual en trámite; continuamos con esa.',
    'El trámite no corresponde a la coordinación académica: debes hacerlo en Admisiones y Registro.'
  ];
  v_notas_reapertura text[] := array[
    'Se reabre: el estudiante presentó un soporte nuevo que no se había considerado.',
    'Se reabre para revisar de nuevo la decisión con el concepto del docente.'
  ];

  v_pesos_dia numeric[];
  v_pesos_alumnos numeric[];
  v_ids_alumnos uuid[];
  v_total numeric;
  v_w integer;
  v_d integer;
  v_ts timestamptz;
  v_intentos integer;
  v_ti integer;
  v_origen public.origen_solicitud;
  r record;
  v_alumno record;
  v_id uuid;
  v_resp uuid;
  v_resp_final uuid;
  v_ritmo numeric;
  v_actor uuid;
  v_par jsonb;
  v_vals jsonb;
  v_asunto text;
  v_cuerpo text;
  v_descripcion text;
  v_t1 timestamptz;
  v_t2 timestamptz;
  v_t3 timestamptz;
  v_t4 timestamptz;
  v_t timestamptz;
  v_dia date;
  v_estado public.estado_solicitud;
  v_final public.estado_solicitud;
  v_obs text;
  v_ult timestamptz;
  v_cerrada timestamptz;
  v_fin timestamptz;
  v_sigue boolean;
  v_atendida boolean;
  v_reaperturas integer := 0;
begin
  perform setseed(c_semilla);

  select id into v_admin from public.perfiles where rol = 'admin' order by creado, id limit 1;
  if v_admin is null then
    raise exception 'No hay ningún admin: crea tu usuario y asígnale rol admin antes de correr este seed.';
  end if;
  if exists (select 1 from public.solicitudes) then
    raise exception 'Ya hay solicitudes: este seed es solo para una base vacía.';
  end if;
  if c_estudiantes not between 1 and array_length(v_nombres, 1) then
    raise exception 'c_estudiantes debe estar entre 1 y %.', array_length(v_nombres, 1);
  end if;
  if c_estudiante_demo <> '' then
    select id into v_demo from public.perfiles where correo = lower(c_estudiante_demo) and rol = 'estudiante';
    if v_demo is null then
      raise exception 'No hay ningún estudiante con el correo % (c_estudiante_demo).', c_estudiante_demo;
    end if;
  end if;

  v_semestre := case
    when extract(month from v_ahora at time zone 'America/Bogota') >= 7
      then (extract(year from v_ahora at time zone 'America/Bogota')::integer + 1) || '-1'
    else extract(year from v_ahora at time zone 'America/Bogota')::integer || '-2'
  end;

  insert into seed_asesores (id, ritmo)
  select id, v_ritmos[1 + (row_number() over (order by creado, id) - 1)::integer % array_length(v_ritmos, 1)]
  from public.perfiles
  where rol = 'asesor';

  -- 1. Estudiantes sintéticos. El trigger al_confirmar_correo crea su perfil; la fecha de la
  --    cuenta se ajusta al final, antes de su primera solicitud.
  insert into seed_alumnos (id, nombre, correo, codigo, peso, demo)
  select
    ('00000000-0000-4000-b000-' || lpad(n::text, 12, '0'))::uuid,
    v_nombres[n],
    lower(translate(
      replace(split_part(v_nombres[n], ' ', 1) || '.' || (string_to_array(v_nombres[n], ' '))[array_length(string_to_array(v_nombres[n], ' '), 1)], ' ', ''),
      'áéíóúñÁÉÍÓÚÑ', 'aeiounAEIOUN'
    )) || '@demo.test',
    '000' || lpad((310000 + (n * 7919) % 89999)::text, 6, '0'),
    1 / power(n, 0.3),
    false
  from generate_series(1, c_estudiantes) n;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', a.id, 'authenticated', 'authenticated', a.correo,
    extensions.crypt(gen_random_uuid()::text, extensions.gen_salt('bf')),
    v_ahora - interval '90 days',
    '{"provider": "email", "providers": ["email"]}',
    jsonb_build_object('nombre', a.nombre, 'id_estudiantil', a.codigo),
    v_ahora - interval '90 days', v_ahora - interval '90 days',
    '', '', '', ''
  from seed_alumnos a
  on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select a.id::text, a.id, jsonb_build_object('sub', a.id::text, 'email', a.correo, 'email_verified', true),
    'email', v_ahora, v_ahora, v_ahora
  from seed_alumnos a
  on conflict do nothing;

  if v_demo is not null then
    insert into seed_alumnos (id, nombre, correo, codigo, peso, demo)
    select id, nombre, correo, id_estudiantil, 0, true from public.perfiles where id = v_demo;
  end if;

  select array_agg(id order by peso desc, id), array_agg(peso order by peso desc, id)
  into v_ids_alumnos, v_pesos_alumnos
  from seed_alumnos where not demo;

  -- 2. Llegadas: día según el día de la semana y la temporada; hora según el horario típico.
  for v_d in 0 .. v_dias - 1 loop
    v_w := 1 + (v_d * 8) / v_dias;
    v_total := 0;
    for i in 1 .. 6 loop
      v_total := v_total + v_temporada[i][v_w];
    end loop;
    v_pesos_dia[v_d + 1] := v_peso_dia[extract(isodow from v_dia0 + v_d)::integer] * v_total;
  end loop;

  for i in 1 .. c_solicitudes loop
    v_d := pg_temp.ponderado(v_pesos_dia) - 1;
    v_intentos := 0;
    loop
      v_ts := ((v_dia0 + v_d) + make_interval(
        hours => pg_temp.ponderado(v_peso_hora) - 1,
        mins => floor(random() * 60)::integer,
        secs => floor(random() * 60)
      )) at time zone 'America/Bogota';
      exit when v_ts < v_ahora - interval '10 minutes';
      v_intentos := v_intentos + 1;
      if v_intentos > 30 then
        v_ts := v_ahora - make_interval(mins => 30 + floor(random() * 600)::integer);
        exit;
      end if;
    end loop;

    v_w := 1 + (v_d * 8) / v_dias;
    v_ti := pg_temp.ponderado(array[
      v_temporada[1][v_w], v_temporada[2][v_w], v_temporada[3][v_w],
      v_temporada[4][v_w], v_temporada[5][v_w], v_temporada[6][v_w]
    ]);
    -- Por correo llega cerca de una de cada cinco; las consultas sueltas ("otro"), casi todas.
    v_origen := case
      when v_tipos[v_ti] = 'otro' then case when random() < 0.7 then 'correo' else 'web' end
      when random() < 0.22 then 'correo'
      else 'web'
    end::public.origen_solicitud;

    insert into seed_llegadas (creada, tipo, origen, alumno, ambigua, forzado)
    values (
      v_ts, v_tipos[v_ti], v_origen,
      v_ids_alumnos[pg_temp.ponderado(v_pesos_alumnos)],
      v_origen = 'correo' and v_tipos[v_ti] not in ('otro', 'comite_curricular') and random() < 0.25,
      null
    );
  end loop;

  if v_demo is not null then
    insert into seed_llegadas (creada, tipo, origen, alumno, ambigua, forzado) values
      (v_ahora - interval '46 days 5 hours', 'homologacion', 'web', v_demo, false, 'finalizada'),
      (v_ahora - interval '25 days 2 hours', 'cancelacion_extemporanea', 'web', v_demo, false, 'rechazada'),
      (v_ahora - interval '12 days 20 hours', 'supletorio', 'correo', v_demo, false, 'finalizada');
  end if;

  -- 3. Cada caso, en orden de llegada, con las reglas de la base. Los triggers van apagados: las
  --    fechas son pasadas, así que aquí se escribe a mano lo que asignar_responsable y
  --    registrar_historial habrían hecho. También apaga los Database Webhooks de n8n (sin correos).
  alter table public.solicitudes disable trigger user;
  alter table public.historial_estados disable trigger user;

  for r in select * from seed_llegadas order by creada loop
    v_id := gen_random_uuid();
    v_ti := array_position(v_tipos, r.tipo);
    select * into v_alumno from seed_alumnos where id = r.alumno;

    -- Asignación como asignar_responsable(): menos casos abiertos en ese momento y, en empate, el
    -- que lleva más tiempo sin recibir uno.
    select a.id, a.ritmo into v_resp, v_ritmo
    from seed_asesores a
    left join lateral (
      select
        count(*) filter (where c.creada <= r.creada and coalesce(c.fin, 'infinity') > r.creada) as abiertas,
        max(c.creada) as ultima
      from seed_casos c
      where c.responsable = a.id
    ) x on true
    where a.id <> r.alumno
    order by x.abiertas, x.ultima nulls first, a.id
    limit 1;
    v_ritmo := coalesce(v_ritmo, 1);
    v_actor := coalesce(v_resp, v_admin);
    v_resp_final := v_resp;

    -- Textos
    v_vals := jsonb_build_object(
      'materia', pg_temp.uno(v_materias),
      'motivo', coalesce(pg_temp.uno(v_motivos -> r.tipo::text), ''),
      'institucion', pg_temp.uno(v_instituciones),
      'semestre', v_semestre,
      'nombre', v_alumno.nombre,
      'nombre_corto', split_part(v_alumno.nombre, ' ', 1),
      'codigo', coalesce(v_alumno.codigo, '')
    );
    if r.tipo in ('comite_curricular', 'otro') then
      v_par := (v_pares -> r.tipo::text) -> floor(random() * jsonb_array_length(v_pares -> r.tipo::text))::integer;
      v_asunto := v_par ->> 0;
      v_cuerpo := v_par ->> 1;
    else
      v_asunto := case
        when r.ambigua then pg_temp.uno(v_asuntos_ambiguos)
        when r.origen = 'correo' then pg_temp.uno(v_asuntos_correo -> r.tipo::text)
        else pg_temp.uno(v_asuntos_web -> r.tipo::text)
      end;
      v_cuerpo := pg_temp.uno(v_cuerpos -> r.tipo::text);
    end if;
    v_descripcion := case
      when r.origen = 'correo' then
        pg_temp.uno(v_saludos) || E'\n\n' || v_cuerpo || E'\n\n' || pg_temp.uno(v_despedidas)
      when random() < 0.3 then
        pg_temp.uno(array['Buenas tardes. ', 'Buenos días. ', 'Hola. ']) || v_cuerpo
      else v_cuerpo
    end;
    v_asunto := pg_temp.rellenar(v_asunto, v_vals);
    v_descripcion := pg_temp.rellenar(v_descripcion, v_vals);

    -- Creación: por la web la registra el estudiante; por correo, n8n (sin usuario).
    insert into seed_eventos values (v_id, r.creada, null, 'pendiente', null, case when r.origen = 'web' then r.alumno end);
    v_estado := 'pendiente';
    v_obs := null;
    v_ult := r.creada;
    v_cerrada := null;
    v_fin := null;
    v_sigue := true;
    v_atendida := false;
    v_t1 := pg_temp.laboral(r.creada + make_interval(secs => v_horas_atencion[v_ti] * v_ritmo * pg_temp.ruido(0.6) * 3600));

    -- El estudiante la retira antes de que la atiendan.
    if r.forzado is null and random() < 0.05 then
      v_t := r.creada + make_interval(mins => 90 + floor(random() * 2400)::integer);
      if v_t < v_t1 and v_t < v_ahora then
        insert into seed_eventos values (v_id, v_t, 'pendiente', 'retirada', null, r.alumno);
        v_estado := 'retirada';
        v_ult := v_t;
        v_fin := v_t;
        v_sigue := false;
      end if;
    end if;

    -- Primera atención (o rechazo directo).
    if v_sigue and v_t1 >= v_ahora then
      v_sigue := false;
    end if;
    if v_sigue then
      v_atendida := true;
      if r.forzado is null and random() < 0.04 then
        v_obs := pg_temp.uno(v_rechazos_directos);
        insert into seed_eventos values (v_id, v_t1, 'pendiente', 'rechazada', v_obs, v_actor);
        v_estado := 'rechazada';
        v_ult := v_t1;
        v_cerrada := v_t1;
        v_fin := v_t1;
        v_sigue := false;
      else
        v_obs := case when random() < 0.6 then pg_temp.rellenar(pg_temp.uno(v_notas_proceso -> r.tipo::text), v_vals) end;
        insert into seed_eventos values (v_id, v_t1, 'pendiente', 'en_proceso', v_obs, v_actor);
        v_estado := 'en_proceso';
        v_ult := v_t1;
      end if;
    end if;

    -- Resolución. El comité sesiona los jueves en la mañana: decide en la primera sesión con al
    -- menos dos días para estudiar el caso, a veces aplaza una semana, y el asesor lo registra después.
    if v_sigue then
      if r.tipo = 'comite_curricular' then
        v_dia := ((v_t1 + interval '2 days') at time zone 'America/Bogota')::date;
        while extract(isodow from v_dia) <> 4 loop
          v_dia := v_dia + 1;
        end loop;
        if random() < 0.25 then
          v_dia := v_dia + 7;
        end if;
        v_t2 := pg_temp.laboral(
          ((v_dia + time '10:00') at time zone 'America/Bogota') + make_interval(hours => floor(random() * 30)::integer)
        );
      else
        v_t2 := pg_temp.laboral(v_t1 + make_interval(secs => v_horas_resolucion[v_ti] * v_ritmo * pg_temp.ruido(0.7) * 3600));
      end if;
      v_vals := v_vals || jsonb_build_object(
        'fecha', to_char(v_t2 at time zone 'America/Bogota', 'DD/MM'),
        'fecha_examen', to_char(pg_temp.laboral(v_t2 + make_interval(days => 3 + floor(random() * 4)::integer)) at time zone 'America/Bogota', 'DD/MM')
      );

      if r.forzado is null and random() < 0.02 then
        -- El estudiante pidió retirarla y la coordinación lo registra (exige observación).
        if v_t2 < v_ahora then
          v_obs := 'El estudiante pidió por correo retirar la solicitud.';
          insert into seed_eventos values (v_id, v_t2, 'en_proceso', 'retirada', v_obs, v_actor);
          v_estado := 'retirada';
          v_ult := v_t2;
          v_fin := v_t2;
        end if;
        v_sigue := false;
      elsif v_t2 >= v_ahora then
        v_sigue := false;
      else
        v_final := coalesce(
          r.forzado,
          case when random() < v_prob_rechazo[v_ti] then 'rechazada' else 'finalizada' end::public.estado_solicitud
        );
        v_obs := pg_temp.rellenar(pg_temp.uno(
          case v_final when 'rechazada' then v_notas_rechazo else v_notas_aprobacion end -> r.tipo::text
        ), v_vals);
        insert into seed_eventos values (v_id, v_t2, 'en_proceso', v_final, v_obs, v_actor);
        v_estado := v_final;
        v_ult := v_t2;
        v_cerrada := v_t2;
        v_fin := v_t2;
      end if;
    end if;

    -- Reapertura: el admin reabre con motivo y reasigna a otro asesor, que la resuelve.
    if v_sigue and r.forzado is null and v_reaperturas < 2
       and v_t2 < v_ahora - interval '10 days' and random() < 0.1 then
      v_t3 := pg_temp.laboral(v_t2 + make_interval(hours => 20 + floor(random() * 70)::integer));
      if v_t3 < v_ahora then
        v_obs := pg_temp.uno(v_notas_reapertura);
        insert into seed_eventos values (v_id, v_t3, v_estado, 'en_proceso', v_obs, v_admin);
        v_estado := 'en_proceso';
        v_ult := v_t3;
        v_cerrada := null;
        v_fin := null;
        v_reaperturas := v_reaperturas + 1;
        select id into v_resp_final from seed_asesores where id <> v_resp order by random() limit 1;
        v_resp_final := coalesce(v_resp_final, v_resp);
        v_t4 := pg_temp.laboral(v_t3 + make_interval(hours => 24 + floor(random() * 72)::integer));
        if v_t4 < v_ahora then
          v_obs := 'Revisada de nuevo con el soporte nuevo: solicitud aprobada.';
          insert into seed_eventos values (v_id, v_t4, 'en_proceso', 'finalizada', v_obs, coalesce(v_resp_final, v_admin));
          v_estado := 'finalizada';
          v_ult := v_t4;
          v_cerrada := v_t4;
          v_fin := v_t4;
        end if;
      end if;
    end if;

    -- La observación vigente es la de la última transición (la creación no lleva).
    if v_ult = r.creada then
      v_obs := null;
    end if;

    insert into public.solicitudes (
      id, estudiante_id, tipo, asunto, descripcion, estado, observaciones, origen, responsable_id,
      creada, actualizada, cerrada
    ) values (
      v_id, r.alumno,
      case when r.ambigua and not v_atendida then 'otro' else r.tipo end,
      left(v_asunto, 200), v_descripcion, v_estado, v_obs, r.origen,
      coalesce(v_resp_final, case when v_atendida then v_admin end),
      r.creada, v_ult, v_cerrada
    );
    insert into seed_casos values (v_id, v_resp, r.creada, v_fin);
  end loop;

  insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha)
  select solicitud_id, anterior, nuevo, observacion, usuario, fecha from seed_eventos order by fecha;

  alter table public.solicitudes enable trigger user;
  alter table public.historial_estados enable trigger user;

  -- 4. Lo que n8n habría registrado en avisos_enviados (sin enviar nada).
  insert into public.avisos_enviados (solicitud_id, tipo_aviso, destinatario, resultado, fecha)
  select solicitud_id, tipo_aviso, destinatario, 'enviada', fecha
  from (
    -- F1: al estudiante, y al asesor asignado (o a todo el personal si quedó sin asignar).
    select s.id as solicitud_id, 'registro_estudiante' as tipo_aviso, a.correo as destinatario,
      s.creada + interval '3 seconds' as fecha
    from public.solicitudes s
    join seed_alumnos a on a.id = s.estudiante_id
    union all
    select c.id, 'registro_admin', p.correo, c.creada + interval '4 seconds'
    from seed_casos c
    join public.perfiles p
      on (c.responsable is not null and p.id = c.responsable)
      or (c.responsable is null and p.rol in ('asesor', 'admin'))
    union all
    -- F2: al estudiante en cada cambio de estado.
    select e.solicitud_id, 'cambio_estado', a.correo, e.fecha + interval '5 seconds'
    from seed_eventos e
    join public.solicitudes s on s.id = e.solicitud_id
    join seed_alumnos a on a.id = s.estudiante_id
    where e.anterior is not null
    union all
    -- F3: cada 3 días a las 8:00 mientras el caso siga abierto y sin cambios hace 3 días o más.
    select t.solicitud_id, 'recordatorio', p.correo, f.fecha + interval '6 seconds'
    from (
      select
        e.solicitud_id,
        e.nuevo,
        e.fecha as desde,
        coalesce(lead(e.fecha) over (partition by e.solicitud_id order by e.fecha), v_ahora) as hasta
      from seed_eventos e
    ) t
    join public.solicitudes s on s.id = t.solicitud_id
    join public.perfiles p
      on (s.responsable_id is not null and p.id = s.responsable_id)
      or (s.responsable_id is null and p.rol = 'admin')
    cross join lateral generate_series(pg_temp.ocho_am(t.desde + interval '72 hours'), t.hasta, interval '3 days') as f (fecha)
    where t.nuevo in ('pendiente', 'en_proceso')
      and f.fecha < t.hasta
    union all
    -- F4: respuestas a remitentes sin cuenta.
    select null, 'remitente_desconocido', x.correo, x.fecha
    from (values
      ('julian.mejia94@correo.test', v_ahora - interval '37 days 3 hours'),
      ('egresado.sistemas@correo.test', v_ahora - interval '19 days 6 hours'),
      ('ventas@proveedor.test', v_ahora - interval '6 days 2 hours')
    ) as x (correo, fecha)
  ) avisos
  order by fecha;

  -- 5. Cada cuenta sintética se creó antes de su primera solicitud.
  update public.perfiles p
  set creado = coalesce(x.primera, v_ahora - interval '45 days')
    - make_interval(days => 3 + abs(hashtext(a.correo)) % 40, hours => abs(hashtext(a.nombre)) % 10)
  from seed_alumnos a
  left join (select estudiante_id, min(creada) as primera from public.solicitudes group by estudiante_id) x
    on x.estudiante_id = a.id
  where p.id = a.id and not a.demo;

  update auth.users u
  set created_at = p.creado, updated_at = p.creado, email_confirmed_at = p.creado + interval '4 minutes'
  from public.perfiles p
  join seed_alumnos a on a.id = p.id and not a.demo
  where u.id = p.id;

  -- Al estudiante de la demo solo se le mueve la fecha del perfil (la web no la muestra), no la
  -- de su cuenta de autenticación.
  update public.perfiles p
  set creado = x.primera - interval '20 days'
  from (select min(creada) as primera from public.solicitudes where estudiante_id = v_demo) x
  where p.id = v_demo and p.creado > x.primera;
end;
$$;

commit;

-- Verificación: cómo quedó repartido.
select 'solicitudes' as indicador, count(*)::text as valor from public.solicitudes
union all
select 'por estado', string_agg(estado || ' ' || n, ', ' order by n desc)
from (select estado::text, count(*) n from public.solicitudes group by 1) x
union all
select 'por tipo', string_agg(tipo || ' ' || n, ', ' order by n desc)
from (select tipo::text, count(*) n from public.solicitudes group by 1) x
union all
select 'por correo', count(*) filter (where origen = 'correo')::text from public.solicitudes
union all
select 'abiertas por asesor', string_agg(nombre || ' ' || n, ', ' order by n desc)
from (
  select p.nombre, count(*) n from public.solicitudes s join public.perfiles p on p.id = s.responsable_id
  where s.estado in ('pendiente', 'en_proceso') group by 1
) x
union all
select 'estancadas (3 días o más)', count(*)::text from public.solicitudes
where estado in ('pendiente', 'en_proceso') and actualizada < now() - interval '3 days'
union all
select 'historial / avisos', (select count(*) from public.historial_estados) || ' / ' || (select count(*) from public.avisos_enviados);
