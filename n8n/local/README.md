# n8n local

Entorno Docker para desarrollar y probar los flujos contra el Supabase local, sin tocar la
instancia de Azure ni enviar correos reales. Los flujos terminados se exportan a `n8n/*.json`
(un archivo por flujo, según las reglas de [`../README.md`](../README.md)) y desde ahí se importan
en Azure. Todos los comandos se corren desde `n8n/local/`.

La lista de flujos, sus dueños y el subflujo `Enviar-aviso` están en [`../README.md`](../README.md).

## Servicios

| Servicio | Dirección desde tu máquina | Dirección desde n8n |
|---|---|---|
| n8n | http://localhost:5678 | — |
| API de Supabase local | http://127.0.0.1:54321 | `http://supabase_kong_SE_Proyecto:8000` |
| Mailpit: correos que envía n8n | http://127.0.0.1:54324 | SMTP `supabase_inbucket_SE_Proyecto:1025` |
| GreenMail: buzón del proyecto | SMTP `127.0.0.1:3025`, IMAP `127.0.0.1:3143` | IMAP `greenmail:3143` |

n8n se une a la red Docker de Supabase, así que **Supabase tiene que estar corriendo antes**.
Mailpit es el mismo que usa Supabase para los correos de autenticación: ahí aparecen también los
avisos de n8n.

## Primer arranque

```bash
# 1. Supabase local (desde la raíz del repo)
npx supabase start

# 2. Variables (desde n8n/local/)
cp .env.example .env
#    N8N_ENCRYPTION_KEY y WEBHOOK_SECRET: openssl rand -hex 32 / openssl rand -hex 24
#    SUPABASE_SECRET_KEY: campo "Secret" de `npx supabase status`

# 3. Levantar y cargar credenciales y flujos
docker compose up -d
scripts/credenciales.sh
scripts/importar.sh     # importa n8n/*.json, publica los flujos y reinicia n8n (o: scripts/importar.sh F1-registro)
```

Abre http://localhost:5678 y crea la cuenta de dueño (solo existe en tu volumen local).

Credenciales que crea `scripts/credenciales.sh`. Los flujos las referencian por id, así que no
hay que volver a elegirlas al importar:

| Id | Nombre | Uso |
|---|---|---|
| `seSupabaseLocal1` | Supabase local | Nodos Supabase y HTTP Request a la API REST |
| `seSmtpLocal00001` | SMTP local (Mailpit) | Nodos Send Email |
| `seImapLocal00001` | Buzón IMAP local (GreenMail) | Disparador de F4 |
| `seWebhookSecret1` | Webhook Supabase (encabezado secreto) | Header Auth de los webhooks F1/F2 |

## Probar

```bash
# F1 / F2 sin esperar a los Database Webhooks (#25). Usa una solicitud real del Supabase local.
scripts/simular-webhook.sh insert f1-registro [solicitud_id]
scripts/simular-webhook.sh update f2-cambio-estado pendiente [solicitud_id]
PRUEBA=1 scripts/simular-webhook.sh insert f1-registro   # con el editor en "Listen for test event"

# F4 / #28: dejar correos en el buzón del proyecto
scripts/correo-prueba.sh ana.gomez@demo.test "Solicitud de supletorio" "Solicito supletorio de..." [adjunto.pdf]
scripts/correo-prueba.sh desconocido@otro.test "Hola" "Quiero información"
```

Los usuarios de prueba del `seed.sql` (`ana.gomez@demo.test`, …) sirven como remitentes
registrados. Revisa los correos enviados en http://127.0.0.1:54324.

## Guardar cambios en Git

```bash
scripts/exportar.sh F1-registro   # escribe n8n/F1-registro.json; sin argumentos exporta todos
                                  # falla si encuentra un secreto; ignora las copias [PRUEBA]
```

La exportación guarda solo la definición del flujo. Quita el dueño (tu nombre y correo), las fechas,
las versiones y los datos fijados (pinData), porque dependen de la instancia o pueden traer datos
de prueba. Los flujos quedan `active: false`: importar siempre despublica, por eso `importar.sh`
vuelve a publicarlos.

Cada flujo lleva una Sticky Note con propósito, dueño y fecha (#30). Exporta solo tus flujos: en
local todos los flujos son de quien corre el entorno, pero en `n8n/` cada archivo tiene su dueño.

## Variables que leen los flujos

Los flujos leen con `$env` estas variables del contenedor. En Azure hay que definir las mismas,
junto con `N8N_BLOCK_ENV_ACCESS_IN_NODE=false`:

| Variable | Uso |
|---|---|
| `APP_URL` | Enlaces de los correos a `/mis-solicitudes/<id>` y `/gestion/solicitudes/<id>` |
| `CORREO_REMITENTE` | Remitente de todos los correos (en local sale de `SMTP_REMITENTE`) |

## Notas para los flujos

- **La llave secreta no tiene usuario**: `auth.uid()` es nulo, así que `es_admin()` da falso. La vista
  `solicitudes_estancadas` le devuelve vacío a n8n. F3 debe consultar `solicitudes` directamente
  (`estado in (pendiente, en_proceso)` y `actualizada` más vieja que 3 días, igual que
  `dias_recordatorio()`). Las demás tablas no tienen ese problema: la llave secreta salta RLS.
- `avisos_enviados.tipo_aviso` solo acepta `registro_estudiante`, `registro_admin`, `cambio_estado`,
  `recordatorio` y `remitente_desconocido`. `resultado` solo acepta `enviada`, `fallida` y
  `pendiente`.
- Los webhooks responden 403 si falta el encabezado `WEBHOOK_HEADER` con `WEBHOOK_SECRET`.
- Para #25 en local, los Database Webhooks de Supabase apuntan a
  `http://n8n:5678/webhook/f1-registro` y `.../f2-cambio-estado`, con ese encabezado. El contenedor
  de la base de datos está en la misma red.

## Reiniciar desde cero

```bash
docker compose down -v   # borra la base de n8n (cuenta, credenciales, ejecuciones)
```
