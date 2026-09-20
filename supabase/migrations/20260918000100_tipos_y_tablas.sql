-- Contrato de datos del sistema de solicitudes (ver docs/contrato-datos.md).
-- Los valores de los enums son códigos estables: la interfaz y n8n los traducen a etiquetas.

create type public.rol_usuario as enum ('estudiante', 'admin');

create type public.estado_solicitud as enum ('pendiente', 'en_proceso', 'finalizada', 'rechazada');

create type public.tipo_solicitud as enum (
  'homologacion',
  'cancelacion_extemporanea',
  'supletorio',
  'reingreso',
  'comite_curricular',
  'otro'
);

create type public.origen_solicitud as enum ('web', 'correo');

create type public.estado_revision as enum ('ok', 'por_revisar');

-- Un perfil existe solo para usuarios con correo confirmado (lo crea un trigger sobre auth.users).
create table public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text not null check (char_length(nombre) between 1 and 120),
  correo text not null unique check (correo = lower(correo)),
  rol public.rol_usuario not null default 'estudiante',
  id_estudiantil text check (id_estudiantil ~ '^[0-9]{4,12}$'),
  creado timestamptz not null default now()
);

create table public.solicitudes (
  id uuid primary key default gen_random_uuid(),
  -- Desde la web toma el usuario de la sesión; n8n (F4) debe enviarlo explícitamente.
  estudiante_id uuid not null default auth.uid() references public.perfiles (id) on delete cascade,
  tipo public.tipo_solicitud not null,
  asunto text not null check (char_length(btrim(asunto)) between 1 and 200),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 20000),
  adjunto_path text,
  estado public.estado_solicitud not null default 'pendiente',
  -- Nota vigente para el estudiante; se reemplaza en cada cambio de estado.
  observaciones text check (char_length(observaciones) <= 2000),
  origen public.origen_solicitud not null default 'web',
  revision public.estado_revision not null default 'ok',
  motivo_revision text check (char_length(motivo_revision) <= 500),
  responsable_id uuid references public.perfiles (id) on delete set null,
  creada timestamptz not null default now(),
  actualizada timestamptz not null default now(),
  -- El adjunto vive en adjuntos/{estudiante_id}/{id}/...; impide apuntar a archivos de otra solicitud.
  constraint adjunto_en_carpeta_propia check (
    adjunto_path is null
    or adjunto_path like estudiante_id::text || '/' || id::text || '/%'
  )
);

create index solicitudes_estudiante_idx on public.solicitudes (estudiante_id, creada desc);
create index solicitudes_estado_idx on public.solicitudes (estado);
create index solicitudes_creada_idx on public.solicitudes (creada desc);
create index solicitudes_por_revisar_idx on public.solicitudes (revision) where revision = 'por_revisar';

create table public.historial_estados (
  id bigint generated always as identity primary key,
  solicitud_id uuid not null references public.solicitudes (id) on delete cascade,
  -- Nulo en la fila de creación.
  estado_anterior public.estado_solicitud,
  estado_nuevo public.estado_solicitud not null,
  observacion text,
  -- Nulo cuando el cambio lo hizo el sistema (n8n con la llave secreta).
  usuario_id uuid references public.perfiles (id) on delete set null,
  fecha timestamptz not null default now()
);

create index historial_solicitud_idx on public.historial_estados (solicitud_id, fecha);

-- Evidencia de cada aviso que envía n8n (R4: permite reprocesar los fallidos).
create table public.avisos_enviados (
  id bigint generated always as identity primary key,
  -- Nulo para avisos sin caso, p. ej. la respuesta a un remitente no registrado.
  solicitud_id uuid references public.solicitudes (id) on delete cascade,
  tipo_aviso text not null check (
    tipo_aviso in (
      'registro_estudiante',
      'registro_admin',
      'cambio_estado',
      'recordatorio',
      'remitente_desconocido'
    )
  ),
  destinatario text not null,
  resultado text not null default 'enviada' check (resultado in ('enviada', 'fallida', 'pendiente')),
  detalle text,
  fecha timestamptz not null default now()
);

create index avisos_solicitud_idx on public.avisos_enviados (solicitud_id, tipo_aviso);
