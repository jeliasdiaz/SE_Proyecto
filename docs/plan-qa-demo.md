# Plan de aseguramiento de calidad para la demo final

Objetivo: que la demo en vivo muestre el sistema completo funcionando de punta a punta
(estudiante → coordinación → administración, con los avisos por correo de n8n) sin sorpresas.

Fecha de la revisión: 26/10/2026 · Rama: `feat/frontend` (commit base `26e8401`, con F4 de Santiago).

---

## 1. Resumen

| Área | Estado | Cómo se verificó |
|---|---|---|
| Base de datos (migraciones, RLS, triggers, seed) | ✅ Funciona | `db reset` desde cero + 50 comprobaciones SQL por rol |
| Web: estudiante, asesor, admin | ✅ Funciona (6 errores corregidos) | 38 pruebas de punta a punta con navegador real |
| Avisos por correo F1 y F2 (n8n) | ✅ Funciona en local (F2 corregido) | Pruebas que leen los correos que llegan a Mailpit |
| F4 (correo → caso) | ✅ Terminado y probado en local; **falta desplegarlo en Azure** | 6 pruebas: caso con adjunto, ambiguo, varios trámites, adjunto no permitido, remitente desconocido y personal |
| F3 (recordatorio) | ✅ Escrito y probado en local; **falta desplegarlo en Azure** | 1 prueba: un resumen por persona y sin repetir |
| Web en Vercel (`gestion-solicitudes-se.vercel.app`) | ✅ Pública; login, registro y recuperación cargan sin errores | Rutas y consola revisadas el 26/10 |
| Supabase en la nube | ✅ Auth responde (estaba pausado; restaurado el 26/10) | Login con una cuenta inexistente: "Correo o contraseña incorrectos" |
| n8n en Azure (`n8n-request.chilecentral.cloudapp.azure.com`) | ✅ En línea; F1 y F2 publicados y protegidos; certificado vigente hasta el 19/12 | `verificar-demo.sh` (parte de n8n) el 26/10 |
| Database Webhooks en la nube | ✅ Existen los de F1 y F2 | Revisados en el panel de Supabase |

Todo lo que dice "funciona" o "probado" se probó contra el entorno **local** (Supabase local + n8n
local), que reproduce producción. La sección 4 es lo que falta hacer o confirmar en la nube.

---

## 2. Resultados de las pruebas

| Suite | Qué cubre | Resultado |
|---|---|---|
| `npm run lint` · `next build` · TypeScript | Calidad estática y compilación de producción | ✅ Sin errores ni advertencias |
| `npm run test:db` (`supabase/snippets/prueba-roles.sql`) | Permisos por rol en la base: asesor, admin, estudiante promovido y estudiante (crear, retirar, no fijar estado, no actuar a nombre de otro) | ✅ 50 comprobaciones |
| `e2e/autenticacion.spec.ts` | Login, errores, inicio por rol, accesos prohibidos, cerrar sesión, registro con confirmación por correo, recuperación de contraseña, enlace inválido | ✅ 11 |
| `e2e/recorrido-demo.spec.ts` | **El guion de la demo** (sección 5) más retiro, clasificación por revisar, filtros y gestión de roles | ✅ 16 |
| `e2e/correos-n8n.spec.ts` | Cadena web → webhook → n8n → correo: F1 a estudiante y coordinación, F2 en cada cambio, que tomar un caso no avise, HTML escapado, registro en `avisos_enviados` | ✅ 4 |
| `e2e/concurrencia-y-tiempo-real.spec.ts` | Dos asesores toman el mismo caso a la vez (solo uno lo obtiene); la bandeja se actualiza sola | ✅ 2 |
| `e2e/salud-pantallas.spec.ts` | Todas las pantallas de cada rol en escritorio y en celular: sin errores de consola ni desbordes | ✅ 8 |
| `e2e/casos-borde.spec.ts` | Cuenta con sesión pero sin perfil | ✅ 1 |
| `e2e/correo-a-caso.spec.ts` | F4: correo de estudiante con PDF → solicitud con adjunto y aviso de F1, visible y descargable en la web; trámite no reconocido → por revisar y clasificación; varios trámites; adjunto no permitido; remitente desconocido (respuesta, sin caso); personal de la coordinación | ✅ 6 |
| `e2e/recordatorios.spec.ts` | F3: un resumen por persona con sus casos estancados (los sin responsable, a los admins); una segunda ejecución no repite | ✅ 1 |

La suite completa (49 pruebas) pasa con la base recién reseteada. Las 42 que no dependen de F3 y
F4 pasaron además dos veces seguidas sin reiniciar la base: se pueden repetir cuantas veces se
quiera.

---

## 3. Errores encontrados y corregidos

| # | Problema | Impacto en la demo | Corrección |
|---|---|---|---|
| 1 | `/auth/confirm` redirigía a `localhost:3000` sin importar el dominio real (en `next start`, `request.nextUrl` trae localhost). La sesión quedaba en otro origen. | Registro y recuperación de contraseña dejaban al usuario **"sin sesión"** al usar la app por `127.0.0.1` (la `site_url` local): rompía el plan B. | `web/src/app/auth/confirm/route.ts` redirige con rutas relativas (`redirect()` de Next). |
| 2 | Una cuenta con sesión pero sin perfil (creada antes del trigger o con el perfil borrado) entraba en un **bucle `/` ↔ `/login`**. | Pantalla en blanco si alguien entra con una cuenta así. | `lib/auth.ts`, `app/page.tsx`, `lib/supabase/proxy.ts`: el login muestra un aviso claro y permite entrar con otra cuenta. |
| 3 | F2 no conocía el estado **Retirada** (correo con "retirada" en minúscula y sin mensaje) y al **reabrir** decía "La coordinación empezó a revisar tu solicitud". | Correos raros justo en dos momentos que se pueden mostrar. | `n8n/F2-cambio-estado.json`: etiqueta y mensaje para Retirada; asunto y mensaje propios para la reapertura. **Hay que reimportarlo en Azure.** |
| 4 | Al intentar rechazar sin observación, el error salía pero el selector volvía a "Elige el siguiente paso" y la etiqueta a "(opcional)". | Mostrar la regla de negocio "rechazar exige motivo" se veía confuso. | `panel-gestion.tsx`: el formulario conserva lo elegido si falla y se limpia solo si el cambio sale bien. |
| 5 | El aviso de desbalance decía "Mateo concentra el 50 %" cuando Laura tenía el mismo número de casos. | Con los datos de prueba, el aviso nombraba a uno solo en un empate. | `admin/page.tsx`: con empate en el primer lugar no se muestra. |
| 6 | En n8n local, `APP_URL` era `localhost` y la web vive en `127.0.0.1`. | El enlace del correo abría la app sin sesión. | `n8n/local/.env.example` y `docker-compose.yml` usan `127.0.0.1`. |

Además se agregó `n8n/local/scripts/webhooks.sh` (los Database Webhooks del #25 en local) e
`infra/verificar-demo.sh` (revisión de producción, sección 6).

### Flujos nuevos: F3 y F4

- **F4-correo-a-caso** (#23) completa la lectura IMAP de Santiago (#22, que se conserva igual). El
  remitente con cuenta de estudiante obtiene una solicitud con `origen = correo`, y el INSERT dispara
  F1. El tipo sale de palabras clave; si no es claro o el correo menciona varios trámites, la
  solicitud queda **por revisar** con el motivo. Guarda un adjunto (PDF, JPG o PNG de hasta 10 MB,
  prefiere el PDF) y anota en el motivo lo que no guardó. Al remitente sin cuenta, o del personal, le
  responde y no crea nada. Ignora rebotes y respuestas automáticas, para no entrar en un ciclo.
- **F3-recordatorio** (#21) corre a las 8:00 o con *Ejecutar ahora*. Manda un resumen por persona
  con sus solicitudes abiertas que llevan 3 días o más sin cambios; las que no tienen responsable
  van a los administradores. Una misma solicitud no se recuerda otra vez antes de 3 días.
- **Enviar-aviso** acepta `solicitud_ids`, para que el resumen de F3 deje una fila por solicitud en
  `avisos_enviados`.

---

## 4. Pendientes en producción (acción del equipo)

Responsables según [`issues-github.md`](issues-github.md). Cada punto dice cómo comprobarlo.

### P0: sin esto no hay demo en la nube

1. ~~**Supabase en la nube pausado.**~~ ✅ Restaurado el 26/10. Antes, un login con una cuenta
   inexistente devolvía "No pudimos completar la operación"; después de restaurarlo devuelve
   "Correo o contraseña incorrectos", como en local. Los proyectos gratuitos se pausan tras 7 días
   sin actividad: **entrar a la app a diario hasta la demo**.
2. **Desplegar las correcciones en Vercel.** La web pública (`gestion-solicitudes-se.vercel.app`)
   funciona, pero corre el commit `fcff23f` del 24/09, sin las correcciones de la sección 3. Al
   integrar los cambios a la rama de producción, Vercel despliega; volver a correr
   `verificar-demo.sh`. De paso, actualizar el sitio del repositorio en GitHub: todavía apunta a
   `se-proyecto-two.vercel.app`, que ya no existe.
3. **Migraciones aplicadas en la nube.** Deben estar las 10 de `supabase/migrations/`, en especial
   las del rol asesor (`20260925*`) y `20260926000100_rendimiento.sql`: sin `conteos_bandeja()` la
   bandeja falla. Comprobar en el SQL Editor:
   `select version from supabase_migrations.schema_migrations order by 1;`
   o, con el proyecto vinculado, `npx supabase migration list --linked`.
4. **Autenticación en la nube** (Authentication en el panel). `supabase/config.toml` solo aplica en local:
   - *URL Configuration*: *Site URL* = URL de producción; agregarla también en *Redirect URLs*.
   - *Email Templates*: pegar `supabase/templates/confirmacion.html` y `recuperacion.html`, con los
     asuntos de `config.toml`. Sin ellas los enlaces no pasan por `/auth/confirm` y la recuperación
     de contraseña no funciona.
   - *SMTP*: el correo incluido de Supabase solo entrega a los miembros del equipo del proyecto y
     unos pocos por hora. Para registrar un estudiante en vivo, configurar el SMTP del buzón del
     proyecto (contraseña de aplicación) o usar cuentas creadas de antemano.
5. ✅ **Database Webhooks en la nube (#25).** Existen los dos, hacia
   `https://n8n-request.chilecentral.cloudapp.azure.com/webhook/f1-registro` y `.../f2-cambio-estado`.
   F3 y F4 no necesitan webhook. Falta confirmar que de verdad llegan correos: registrar una
   solicitud de prueba y ver las filas nuevas en `avisos_enviados`
   (`select tipo_aviso, destinatario, resultado, fecha from avisos_enviados order by fecha desc limit 10;`).
6. **n8n en Azure.** En línea, con certificado vigente hasta el 19/12, y F1 y F2 publicados y
   protegidos (403 sin el secreto). Falta, desde la interfaz de n8n (*Import from File* en cada flujo):
   - **Reimportar F1, F2 y Enviar-aviso desde el repositorio.** La copia local de F1 era una versión
     anterior (solo avisaba a admins y enlazaba a `/admin/solicitudes`); la de Azure puede estar
     igual. F2 trae la corrección #3 y Enviar-aviso el cambio para F3.
   - Variables del contenedor: `APP_URL` = URL de producción, `CORREO_REMITENTE`,
     `N8N_BLOCK_ENV_ACCESS_IN_NODE=false` y, nueva para F4, `SUPABASE_URL` (ver punto 8).
   - Después de importar, elegir en cada nodo las credenciales de producción (SMTP, Supabase,
     encabezado secreto e IMAP).
7. **Cuentas para la demo en producción.** Un admin, dos asesores y un estudiante cuyo buzón se pueda
   abrir en pantalla para mostrar los correos. Los estudiantes de `seed-nube.sql` (`@demo.test`)
   no reciben correos ni tienen contraseña conocida: sirven de relleno, no para el recorrido.
8. **Desplegar F3 y F4 en Azure** (issues #21, #23). Ya están escritos y probados en local.
   - Importar `n8n/F3-recordatorio.json` y `n8n/F4-correo-a-caso.json`. F4 conserva el id del flujo
     de lectura de Santiago (`KFHt4aD0YlAJMrYr`), así que lo reemplaza en vez de duplicarlo.
     Mientras tanto, si ese flujo de lectura está publicado, **despublicarlo**: marca cada correo
     como leído sin crear nada, y esos correos ya no los vería el F4 completo.
   - `SUPABASE_URL` (la *Project URL* de Supabase) debe existir como variable del contenedor de
     n8n, porque F4 la usa para subir los adjuntos. Agregarla en el `.env` de la VM requiere acceso
     a Azure. Si no se consigue a tiempo, se puede escribir la URL directamente en el campo URL del
     nodo *Subir adjunto* (no es un secreto).
   - Credenciales: IMAP del buzón del proyecto en *Recibir correos nuevos*, Supabase de producción
     en los nodos Supabase y en *Subir adjunto*.
   - Publicar los dos y probar: un correo desde la cuenta de un estudiante al buzón del proyecto
     debe crear la solicitud en menos de un minuto, y llegarle la confirmación de F1. Para F3,
     *Ejecutar ahora* en el editor.

### P1: importante

9. **`infra/` no tiene la configuración del servidor** (`docker-compose.yml`, `Caddyfile`,
   `.env.example`) que promete su README. Copiarla de la VM, sin secretos.
10. **Next.js 16.3.5 tiene avisos de seguridad** (`npm audit`, corregidos en 16.4.3). Ninguno afecta
    el guion, pero un evaluador podría preguntar. Actualizar solo si queda tiempo para correr toda
    la suite; si no, después de la demo.
11. Cerrar los issues ya resueltos (#4, #5, #19, #20) y los de prueba (#26, #27) cuando se verifique
    producción.

---

## 5. Guion de la demo (10–12 minutos)

Preparación: **un navegador o perfil distinto por rol** (la sesión vive en una cookie por
navegador; dos roles en la misma ventana se pisan). Sesiones iniciadas y pestañas abiertas antes de
empezar: estudiante, asesor A, asesor B, admin y el buzón del estudiante.

| Paso | Quién | Qué se muestra | Qué decir | Prueba que lo cubre |
|---|---|---|---|---|
| 0 | — | Problema y solución | Trámites por correo sin trazabilidad → CRM de servicio con enfoque BPM | — |
| 1 | Estudiante | Nueva solicitud (Supletorio) con un PDF → queda Pendiente con su seguimiento | El estudiante no elige estado ni dueño: lo pone la base | `recorrido-demo` 1 |
| 2 | Buzón | Correo "Recibimos tu solicitud" | n8n F1, disparado por el webhook de Supabase | `correos-n8n` F1 |
| 3 | Asesor A | Bandeja → chip "Sin asignar" → **Tomar** | Mientras, la bandeja del asesor B se actualiza sola (tiempo real) | `recorrido-demo` 2, `concurrencia…` |
| 4 | Asesor B | Abre el mismo caso: solo lectura, "La atiende …" | La regla vive en la base (RLS + trigger), no en la interfaz | `recorrido-demo` 3 |
| 5 | Asesor A | Descarga el adjunto. Intenta **Rechazar sin motivo** → error. Pasa a **En proceso** con observación | Reglas de negocio: rechazar exige motivo | `recorrido-demo` 4–6 |
| 6 | Estudiante + buzón | Ve "En proceso", la respuesta y el correo de F2. Ya no puede retirarla | Cada cambio queda en el historial y se avisa | `recorrido-demo` 7, `correos-n8n` F2 |
| 7 | Asesor A | **Finalizada** con observación; el asesor no puede reabrir | — | `recorrido-demo` 8 |
| 8 | Admin | **Carga del equipo** → **Métricas** (tiempos por tipo, estancados) | Indicadores del proceso (BPM) | `recorrido-demo` 10 |
| 9 | Admin | Reabre con motivo y **reasigna** al asesor B | Solo el admin reabre y reasigna | `recorrido-demo` 9 |
| 10 | Admin | **Roles**: buscar un estudiante y hacerlo asesor | El rol admin solo se da por SQL | `recorrido-demo` (roles) |
| 11 | Cualquiera | Seguimiento completo de la solicitud | Trazabilidad: quién, cuándo, de qué estado a cuál | — |

Automatización con F3 y F4 (probados en local; en la nube, después del punto 8 de la sección 4):

| Paso | Quién | Qué se muestra | Qué decir | Prueba que lo cubre |
|---|---|---|---|---|
| 12 | Estudiante | Envía desde su correo, al buzón del proyecto, un correo que no diga qué trámite es. En menos de un minuto aparece como solicitud *Recibida por correo* y *Por revisar*, y le llega la confirmación de F1 | Tarea 1: el correo se vuelve caso sin transcribirlo; lo ambiguo va a revisión humana | `correo-a-caso` |
| 13 | Asesor | Lee el motivo y confirma la clasificación | La automatización sugiere, la persona decide | `correo-a-caso` |
| 14 | — | Un correo desde una dirección sin cuenta recibe la respuesta de cómo registrarse | No se crean casos de desconocidos | `correo-a-caso` |
| 15 | Admin | En n8n, *Ejecutar ahora* en F3 → el resumen de casos estancados llega a cada responsable | Normalmente corre todos los días a las 8:00; no repite avisos | `recordatorios` |

Para el paso 12, enviar el correo **antes** de empezar el paso 11: mientras se muestra el
seguimiento, F4 lo procesa. F3 se puede ejecutar una sola vez al día con resultado visible: la
segunda ejecución no reenvía (es lo esperado).

Opcional si sobra tiempo: el estudiante retira una solicitud pendiente.

Si algo falla en vivo: **Actualizar** (arriba a la derecha) vuelve a pedir los datos sin recargar.
Si un correo tarda, seguir con el guion y volver al buzón al final. Si la nube no responde, pasar
al plan B.

---

## 6. Revisión de producción y checklist del día

```bash
APP_URL=https://gestion-solicitudes-se.vercel.app SUPABASE_URL=https://<proyecto>.supabase.co \
SUPABASE_PUBLISHABLE_KEY=sb_publishable_... N8N_URL=https://n8n-request.chilecentral.cloudapp.azure.com \
infra/verificar-demo.sh
```

- **Un día antes:** todo lo de la sección 4 en OK; ensayo completo del guion en producción, con
  cronómetro; recorrido del plan B en el portátil que se va a usar.
- **Dos horas antes:** `verificar-demo.sh`; registrar una solicitud de prueba y confirmar que llegan
  los dos correos (estudiante y coordinación); retirarla después. Enviar un correo de prueba al buzón
  del proyecto y confirmar que F4 crea el caso.
- **15 minutos antes:** `verificar-demo.sh`; sesiones iniciadas en cada navegador; buzón abierto;
  pantalla y zoom del proyector probados; notificaciones del sistema silenciadas.
- **Durante:** una persona maneja y otra narra; nadie edita flujos de n8n en vivo.

---

## 7. Plan B: todo en el portátil

El entorno local reproduce el sistema completo (base, autenticación, archivos, tiempo real, n8n y
correos en Mailpit). Requiere Docker Desktop con unos 4 GB de memoria. Desde la raíz del repo:

```bash
# Primera vez: web/.env.local (de web/.env.example) y n8n/local/.env (ver n8n/local/README.md)
cd web
npx supabase start --workdir ..
npx supabase db reset --workdir ..           # datos de supabase/seed.sql (contraseña Demo12345)
(cd ../n8n/local && docker compose up -d && scripts/credenciales.sh && scripts/importar.sh)
../n8n/local/scripts/webhooks.sh             # después de cada db reset
npm run build && npm run start -- -H 127.0.0.1 -p 3000
```

- La app en **http://127.0.0.1:3000** (no `localhost`: es la `site_url` de los correos).
- Los correos en **http://127.0.0.1:54324** (Mailpit): ahí se muestran los avisos de F1, F2 y F3 y
  las respuestas de F4.
- F4 lee el buzón de pruebas: `n8n/local/scripts/correo-prueba.sh <remitente> <asunto> <cuerpo>
  [adjunto]` deja un correo como si lo enviara ese remitente. F3: *Ejecutar ahora* en
  http://localhost:5678.
- Usuarios: `admin@demo.test`, `laura.ospina@demo.test`, `mateo.restrepo@demo.test`,
  `ana.gomez@demo.test`, `bruno.diaz@demo.test` (todos con `Demo12345`).

Dejarlo levantado y con las sesiones iniciadas antes de la presentación: si la nube falla, el
cambio toma segundos.

---

## 8. Cómo correr las pruebas

Con el entorno local del plan B levantado, desde `web/`:

```bash
npx supabase db reset --workdir .. && ../n8n/local/scripts/webhooks.sh
npm run test:db                 # permisos en la base (necesita la base recién reseteada)
npx playwright install chromium # solo la primera vez
npm run test:e2e                # 49 pruebas; npx playwright show-report para ver el detalle
```

Las pruebas de n8n (`correos-n8n`, `correo-a-caso`, `recordatorios`) se saltan solas si n8n no
está corriendo. Las demás crean sus propios datos, así que se pueden repetir sin reiniciar la base.
La de F3 borra los recordatorios del Supabase local para partir de cero.
