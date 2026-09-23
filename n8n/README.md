# n8n

Flujos de n8n exportados en JSON: un archivo por flujo.

- Nombre del archivo: `F<n>-<nombre>.json` (por ejemplo, `F1-aviso-registro.json`).
- Cada flujo tiene un único dueño; solo esa persona lo edita y lo exporta.
- Al terminar un cambio, se exporta la versión de producción y se hace commit indicando qué cambió.
- Las copias de prueba (`[PRUEBA] F<n>-<nombre>`) no se suben.

Antes de hacer commit, revisar que el JSON no contenga secretos: las credenciales viven en n8n y el export solo guarda su referencia, pero una llave o contraseña escrita a mano dentro de un nodo (por ejemplo, en un header HTTP) sí quedaría expuesta.

## Flujos

| Archivo | Issue | Dueño | Disparador |
|---|---|---|---|
| [`F1-registro.json`](F1-registro.json) | #19 | Abel | Webhook `f1-registro` (INSERT en `solicitudes`) |
| `F2-cambio-estado.json` | #20 | Abel | Webhook `f2-cambio-estado` (UPDATE en `solicitudes`) |
| `F3-recordatorio.json` | #21 | Santiago | Programado |
| `F4-correo-a-caso.json` | #22, #23 | Santiago | IMAP |
| [`Enviar-aviso.json`](Enviar-aviso.json) | — | Abel | Subflujo: lo llaman otros flujos |

**Enviar-aviso** envía un correo y registra el envío en `avisos_enviados`, también cuando falla
(`resultado = fallida`, con el error en `detalle`). Recibe un ítem por correo: `destinatario`,
`asunto`, `cuerpo` (HTML), `tipo_aviso`, `solicitud_id`. Hoy lo usan F1 y F2. F3 y F4 pueden
llamarlo con el nodo *Execute Workflow* en vez de repetir el envío y el registro; está pendiente
acordarlo con Santiago.

Al importar en Azure, los flujos piden las variables `APP_URL` (enlaces de los correos) y
`CORREO_REMITENTE`, además de `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`. Las credenciales se eligen de
nuevo en cada nodo, con las de producción.

## Desarrollo local

[`local/`](local/) tiene un entorno Docker (n8n y un buzón IMAP de pruebas) que se conecta al
Supabase local. Sirve para construir y probar los flujos sin tocar el servidor de Azure ni enviar
correos reales, y para exportarlos a esta carpeta sin datos de la instancia. Ver
[`local/README.md`](local/README.md).
