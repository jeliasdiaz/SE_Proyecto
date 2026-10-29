-- Asignación automática: cada solicitud nueva (web o correo) queda a cargo del asesor con menos
-- solicitudes abiertas. Lo decide la base y no la web: F4 crea solicitudes sin pasar por la
-- interfaz, y el estudiante no puede ver la carga de los asesores. El INSERT dispara F1, que avisa
-- al asesor asignado.

-- Carga = solicitudes pendientes o en proceso (lo mismo que la barra de carga del panel del admin).
-- Empate: el que lleva más tiempo sin recibir un caso, para repartir por turnos.
-- Sin asesores, la solicitud queda sin asignar y cualquiera del personal puede tomarla.
-- security definer: quien inserta (el estudiante) no ve las solicitudes ni los perfiles ajenos.
create function public.asignar_responsable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_asesor uuid;
begin
  if new.responsable_id is not null then
    return new;
  end if;

  -- Dos solicitudes que llegan a la vez esperan su turno: si no, ambas verían la misma carga y
  -- caerían en el mismo asesor. El bloqueo dura hasta el final de la transacción.
  perform pg_advisory_xact_lock(hashtext('public.asignar_responsable'));

  select p.id
  into v_asesor
  from public.perfiles p
  left join lateral (
    select
      count(*) filter (where s.estado in ('pendiente', 'en_proceso')) as abiertas,
      max(s.creada) as ultima
    from public.solicitudes s
    where s.responsable_id = p.id
  ) c on true
  where p.rol = 'asesor'
    and p.id <> new.estudiante_id
  order by c.abiertas, c.ultima nulls first, p.id
  limit 1;

  -- Bloquea el perfil para que cambiar_rol() no lo degrade mientras recibe el caso; si justo dejó
  -- de ser asesor, la solicitud queda sin asignar.
  if v_asesor is not null and public.puede_ser_responsable(v_asesor) then
    new.responsable_id := v_asesor;
  end if;

  return new;
end;
$$;

revoke execute on function public.asignar_responsable() from public, anon, authenticated;

create trigger asignar_responsable
before insert on public.solicitudes
for each row execute function public.asignar_responsable();
