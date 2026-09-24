-- Estado final para una solicitud que el estudiante retira o de la que desiste.
-- Va sola: un valor nuevo de enum no se puede usar en la misma transacción que lo crea.
alter type public.estado_solicitud add value 'retirada';
