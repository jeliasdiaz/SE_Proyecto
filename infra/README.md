# infra

Configuración del servidor en Azure donde corre n8n.

Aquí van:

- `docker-compose.yml`: contenedores de n8n y Caddy, con la versión de n8n fijada (no `latest`).
- `Caddyfile`: proxy inverso con HTTPS automático para el dominio de la VM.
- `.env.example`: plantilla con los nombres de las variables, **sin valores reales**.
- Notas de despliegue y respaldo del servidor.

El `.env` real existe solo en el servidor. Las contraseñas y llaves se guardan en el gestor de contraseñas del equipo, nunca en Git ni en chats.
