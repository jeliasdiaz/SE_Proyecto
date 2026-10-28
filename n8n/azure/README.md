# Despliegue en n8n de Azure

`desplegar.py` lleva los flujos de `n8n/*.json` a la instancia de Azure por la API pública de n8n.
No necesita acceso a la VM.

**No importes los JSON a mano desde la interfaz.** Traen los ids del entorno local: las
credenciales (`seSupabaseLocal1`, `seSmtpLocal00001`…) y el de Enviar-aviso (`seEnviarAviso001`),
que en Azure son otros. Un F1 importado así deja de enviar correos, y uno creado como flujo nuevo
choca con la ruta del webhook que ya está publicado.

El script:
- respalda todos los flujos de Azure en `respaldos/` (ignorada por Git) antes de cambiar nada;
- actualiza en su lugar los que ya existen: mismo id y misma ruta de webhook, así que los Database
  Webhooks de Supabase siguen funcionando; crea los que faltan;
- cambia las credenciales locales por las de producción (las que ya usan los flujos de Azure) y
  apunta las llamadas a Enviar-aviso a su id real;
- escribe en los nodos `SUPABASE_URL` y `CORREO_REMITENTE` de `.env`, porque las variables de la VM
  no se pueden cambiar sin acceso a Azure;
- publica cada flujo.

## Uso

Requiere Python 3, sin dependencias.

```bash
cp n8n/azure/.env.example n8n/azure/.env    # y pon N8N_API_KEY
python3 n8n/azure/desplegar.py inventario   # qué hay en Azure (solo lee, y respalda)
python3 n8n/azure/desplegar.py plan         # qué haría (solo lee)
python3 n8n/azure/desplegar.py aplicar      # respalda, actualiza y publica

# Solo algunos flujos, o sin publicar (p. ej. F4 antes de revisar el buzón):
python3 n8n/azure/desplegar.py aplicar --solo F4-correo-a-caso --sin-publicar F4-correo-a-caso

# Volver atrás:
python3 n8n/azure/desplegar.py restaurar n8n/azure/respaldos/<fecha>
```

Si hay dos credenciales del mismo tipo y ningún flujo usa todavía la nueva, `plan` se detiene y
pide elegirla: `--credencial imap=<id>` (los ids salen en `inventario`). Borra la llave de API en
n8n cuando termines.

## Producción (28/10/2026)

| Flujo | Id en Azure |
|---|---|
| Enviar-aviso | `tex4WkFWwApsIhpY` |
| F1-registro | `tv68UW0tfpBddpTI` |
| F2-cambio-estado | `e2CmrRKGtCNW9J6e` |
| F3-recordatorio | `7F0SWCpaOuXWBn7d` |
| F4-correo-a-caso | `KFHt4aD0YlAJMrYr` |

El buzón del proyecto es `gestionsolicitudes.se@gmail.com`: F4 lo lee por IMAP y Enviar-aviso
envía por SMTP desde él, con una contraseña de aplicación de Google. Si se cambia la contraseña de
la cuenta, Google revoca las contraseñas de aplicación y n8n deja de leer y de enviar.
