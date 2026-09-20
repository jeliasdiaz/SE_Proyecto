-- Reglas de negocio que deben cumplirse sin importar quién escribe (la web, n8n o el editor SQL).

-- ¿El usuario de la sesión es admin? security definer para que las políticas RLS puedan
-- consultar perfiles sin recursión.
create function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.perfiles
    where id = (select auth.uid())
      and rol = 'admin'
  );
$$;

revoke execute on function public.es_admin() from public, anon;
grant execute on function public.es_admin() to authenticated, service_role;

-- Días sin cambios para considerar un caso estancado. Lo usan la vista de métricas y F3.
create function public.dias_recordatorio()
returns integer
language sql
immutable
as $$ select 3 $$;

-- Crea el perfil cuando el correo queda confirmado, no al registrarse: así nadie puede
-- reclamar el correo de otra persona (F4 identifica al remitente por correo).
-- El rol siempre es 'estudiante': la metadata la controla el usuario y nunca define permisos.
create function public.crear_perfil_confirmado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := left(btrim(coalesce(new.raw_user_meta_data ->> 'nombre', '')), 120);
  v_id_estudiantil text := btrim(coalesce(new.raw_user_meta_data ->> 'id_estudiantil', ''));
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;
  end if;

  -- Un dato inválido no debe bloquear la confirmación de la cuenta: se descarta.
  if v_nombre = '' then
    v_nombre := split_part(new.email, '@', 1);
  end if;
  if v_id_estudiantil !~ '^[0-9]{4,12}$' then
    v_id_estudiantil := null;
  end if;

  insert into public.perfiles (id, nombre, correo, id_estudiantil)
  values (new.id, v_nombre, lower(new.email), v_id_estudiantil)
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger al_confirmar_correo
after insert or update of email_confirmed_at on auth.users
for each row execute function public.crear_perfil_confirmado();

-- Valida cada cambio de una solicitud antes de guardarlo.
create function public.validar_cambio_solicitud()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado then
    if not (
      (old.estado = 'pendiente' and new.estado in ('en_proceso', 'rechazada'))
      or (old.estado = 'en_proceso' and new.estado in ('finalizada', 'rechazada'))
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

    -- El primer admin que mueve el caso queda como responsable (F3 le escribe a esa persona).
    if new.responsable_id is null then
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

create trigger validar_cambio
before update on public.solicitudes
for each row execute function public.validar_cambio_solicitud();

-- Deja constancia de la creación y de cada cambio de estado.
-- security definer: los usuarios no tienen permiso de escribir en historial_estados.
create function public.registrar_historial()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, usuario_id, fecha)
    values (new.id, null, new.estado, (select auth.uid()), new.creada);
  elsif new.estado is distinct from old.estado then
    insert into public.historial_estados (solicitud_id, estado_anterior, estado_nuevo, observacion, usuario_id)
    values (new.id, old.estado, new.estado, new.observaciones, (select auth.uid()));
  end if;
  return null;
end;
$$;

create trigger registrar_historial
after insert or update of estado on public.solicitudes
for each row execute function public.registrar_historial();

revoke execute on function public.crear_perfil_confirmado() from public, anon, authenticated;
revoke execute on function public.validar_cambio_solicitud() from public, anon, authenticated;
revoke execute on function public.registrar_historial() from public, anon, authenticated;
