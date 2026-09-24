# Sistema Inteligente de Gestión de Solicitudes Universitarias

Aplicación web para registrar y hacer seguimiento a trámites académicos de excepción (homologaciones, cancelaciones extemporáneas, supletorios, reingresos, solicitudes a comités). El estudiante registra su solicitud y consulta su avance; un asesor la toma y la gestiona, el administrador supervisa a los asesores, y cada cambio de estado queda en el historial. n8n envía los avisos y convierte en casos las solicitudes que llegan por correo.

Proyecto del curso Sistemas Empresariales (UPB).

## Estructura del repositorio

| Carpeta | Propósito |
|---|---|
| [`web/`](web/) | Frontend (Next.js + React), desplegado en Vercel. |
| [`supabase/`](supabase/) | Base de datos: migraciones SQL, políticas RLS, storage, datos de prueba y plantillas de correo de autenticación. |
| [`n8n/`](n8n/) | Flujos de n8n exportados en JSON, un archivo por flujo. |
| [`infra/`](infra/) | Configuración del servidor en Azure: `docker-compose.yml`, `Caddyfile` y plantilla de variables de entorno. |
| [`docs/`](docs/) | Propuesta, plan, diagramas y evidencias del proyecto. |

Cada carpeta tiene su propio README con más detalle.

## Roles

| Rol | Entra a | Puede |
|---|---|---|
| Estudiante | `/mis-solicitudes` | Registrar solicitudes, seguir las suyas y retirar una pendiente. |
| Asesor | `/gestion` | Ver todas las solicitudes, **tomar** una sin responsable y gestionar solo las suyas (estado, observación, clasificación). |
| Administrador | `/admin` | Todo lo del asesor sobre cualquier caso, más: reasignar o liberar casos, reabrir uno finalizado o rechazado, ver la carga de cada asesor y las métricas, y dar o quitar el rol de asesor (`/admin/usuarios`). |

Las reglas viven en la base de datos (RLS y el trigger `validar_cambio_solicitud`), no en la interfaz: dos asesores que toman el mismo caso a la vez compiten por el bloqueo de la fila y solo uno lo obtiene. El rol de administrador solo se asigna por SQL. `supabase/snippets/prueba-roles.sql` comprueba estas reglas contra la base local.

## Stack

| Componente | Herramienta |
|---|---|
| Frontend | Next.js (React) en Vercel |
| Base de datos, autenticación y archivos | Supabase |
| Automatización | n8n Community Edition en una VM de Azure |
| HTTPS del servidor | Caddy |

## Cómo empezar

```bash
git clone https://github.com/jeliasdiaz/SE_Proyecto.git
cd SE_Proyecto
```

Frontend:

```bash
cd web
cp .env.example .env.local   # completar con la URL y la llave publishable de Supabase
npm install
npm run dev
```

Supabase local (requiere Docker), desde la raíz del repositorio:

```bash
npx supabase start
```

## Secretos y credenciales

- Ninguna credencial se sube a Git. Solo se versionan las plantillas `.env.example`, sin valores reales.
- Los valores reales viven en el gestor de contraseñas del equipo, en Vercel, en Supabase o en el servidor.
- La llave secreta de Supabase (`service_role` / `sb_secret_...`) nunca va en el frontend; solo la usa n8n.
- Antes de hacer commit de un flujo de n8n, revisar que el JSON no contenga llaves ni contraseñas escritas en los nodos.

## Equipo

José Díaz · Edwin Vélez · Miguel Moreno · Abel García · Santiago Martínez
