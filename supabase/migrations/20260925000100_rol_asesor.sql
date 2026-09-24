-- Rol intermedio: atiende solicitudes; el admin lo supervisa, reasigna y gestiona los roles.
-- Va sola: un valor nuevo de enum no se puede usar en la misma transacción que lo crea.
alter type public.rol_usuario add value 'asesor' before 'admin';
