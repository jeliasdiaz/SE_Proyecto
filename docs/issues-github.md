# Issues — Sistema de Gestión de Solicitudes (MVP)

## Configuración del GitHub Project

**Labels:** `setup` · `frontend` · `supabase` · `infra` · `n8n` · `integration` · `testing` · `documentation`

**Milestones:**
- `M1 - Avance jueves`
- `M2 - MVP`
- `M3 - Pruebas`
- `M4 - Cierre`
- `Backlog`

**Campo personalizado "Responsable":** Miguel · José · David · Abel · Santiago · Todos

| Integrante | Área |
|---|---|
| Miguel | Frontend React |
| José | Frontend React |
| David | Infraestructura + Supabase |
| Abel | n8n — F1/F2 |
| Santiago | n8n — F3/F4 |
| Todos | Integración, pruebas y documentación |

---

## Resumen por milestone

| # | Issue | Responsable | Milestone |
|---|---|---|---|
| 1 | Crear estructura base del repositorio | David | M1 |
| 2 | Crear proyecto y configuración inicial de Supabase | David | M1 |
| 3 | Crear esquema inicial de base de datos | David | M1 |
| 4 | Implementar historial automático de estados | David | M2 |
| 5 | Configurar seguridad y almacenamiento de adjuntos | David | M2 |
| 6 | Crear infraestructura base en Azure | David | M1 |
| 7 | Preparar servidor para n8n | David | M1 |
| 8 | Desplegar n8n con Docker | David | M1 |
| 9 | Configurar HTTPS para n8n | David | M1 |
| 10 | Inicializar aplicación React | Miguel | M1 |
| 11 | Implementar autenticación | Miguel | M1 |
| 12 | Implementar dashboard del estudiante | Miguel | M1 |
| 13 | Implementar formulario de nueva solicitud | Miguel | M1 |
| 14 | Implementar dashboard administrativo | José | M1 |
| 15 | Implementar filtros de solicitudes | José | M2 |
| 16 | Implementar gestión de estados y observaciones | José | M1 |
| 17 | Implementar historial de solicitudes | José | M2 |
| 18 | Configurar credenciales de Supabase y SMTP | Abel | M1 |
| 19 | Implementar F1 — Confirmación de registro | Abel | M1 |
| 20 | Implementar F2 — Cambio de estado | Abel | M2 |
| 21 | Implementar F3 — Recordatorio de solicitudes | Santiago | M2 |
| 22 | Configurar lectura de correos mediante IMAP | Santiago | M1 |
| 23 | Implementar F4 — Correo a caso | Santiago | M2 |
| 24 | Integrar frontend con Supabase | Miguel + José | M2 |
| 25 | Integrar Supabase con n8n | David + Abel | M2 |
| 26 | Primera integración React → Supabase → n8n | Todos | M1 |
| 27 | Ejecutar recorrido completo del MVP | Todos | M3 |
| 28 | Prueba de correo ambiguo y remitente desconocido | Santiago + Abel | M3 |
| 29 | Documentar arquitectura del sistema | Miguel + David | M4 |
| 30 | Documentar workflows de n8n | Abel + Santiago | M4 |
| 31 | Bot de navegador / RPA | — | Backlog |

---

# ISSUES

---

## 1. Crear estructura base del repositorio

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `setup` · **Milestone:** M1 - Avance jueves

### Descripción
Preparar la estructura inicial del repositorio para organizar el código de frontend, infraestructura, base de datos, automatizaciones y documentación.

### Tareas
- [ ] Crear `/infra`
- [ ] Crear `/supabase`
- [ ] Crear `/n8n`
- [ ] Crear `/app`
- [ ] Crear `/docs`
- [ ] Agregar `.gitignore`
- [ ] Crear README inicial
- [ ] Documentar brevemente el propósito de cada carpeta

### Criterios de aceptación
- [ ] El repositorio tiene las carpetas principales definidas
- [ ] El README explica la estructura del proyecto
- [ ] Ninguna credencial o secreto está almacenado en Git
- [ ] Los cinco integrantes pueden clonar y trabajar sobre el repositorio

---

## 2. Crear proyecto y configuración inicial de Supabase

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `supabase` · **Milestone:** M1 - Avance jueves

### Descripción
Configurar el proyecto de Supabase que funcionará como backend principal: base de datos, autenticación y almacenamiento de archivos.

### Tareas
- [ ] Crear proyecto Supabase
- [ ] Configurar autenticación
- [ ] Verificar acceso a PostgreSQL
- [ ] Verificar Storage
- [ ] Obtener las credenciales necesarias
- [ ] Mantener las credenciales fuera del repositorio
- [ ] Documentar las variables de entorno necesarias

### Criterios de aceptación
- [ ] El proyecto Supabase está creado y accesible
- [ ] La autenticación está habilitada
- [ ] La base de datos está disponible
- [ ] Storage está habilitado
- [ ] Las credenciales sensibles no están en Git

---

## 3. Crear esquema inicial de base de datos

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `supabase` · **Milestone:** M1 - Avance jueves

### Descripción
Implementar el esquema para gestionar usuarios, solicitudes, historial de estados y avisos enviados.

### Tareas
- [ ] Crear tabla `perfiles`
- [ ] Crear tabla `solicitudes`
- [ ] Crear tabla `historial_estados`
- [ ] Crear tabla `avisos_enviados`
- [ ] Definir claves primarias
- [ ] Definir relaciones entre tablas
- [ ] Definir campos obligatorios
- [ ] Definir estados de las solicitudes
- [ ] Definir origen de las solicitudes (`web` / `correo`)
- [ ] Definir estado de revisión (`por_revisar`)

### Criterios de aceptación
- [ ] Las cuatro tablas existen en Supabase
- [ ] Las relaciones están correctamente definidas
- [ ] `solicitudes` diferencia origen `web` y `correo`
- [ ] `solicitudes` permite representar casos `por_revisar`
- [ ] El esquema puede recrearse con el SQL almacenado en `/supabase`

---

## 4. Implementar historial automático de estados

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `supabase` · **Milestone:** M2 - MVP

### Descripción
Registrar automáticamente cada cambio de estado de una solicitud para conservar la trazabilidad.

### Tareas
- [ ] Crear trigger sobre `solicitudes`
- [ ] Detectar modificaciones del campo `estado`
- [ ] Registrar estado anterior
- [ ] Registrar estado nuevo
- [ ] Registrar usuario responsable
- [ ] Registrar fecha del cambio
- [ ] Evitar registros cuando el estado no cambie

### Criterios de aceptación
- [ ] Cambiar el estado genera un registro en `historial_estados`
- [ ] El registro contiene estado anterior y nuevo
- [ ] Se almacena la fecha del cambio
- [ ] No se generan registros si el estado no cambia

---

## 5. Configurar seguridad y almacenamiento de adjuntos

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `supabase` · **Milestone:** M2 - MVP

### Descripción
Configurar las políticas de seguridad (RLS) y el almacenamiento de archivos de las solicitudes.

### Tareas
- [ ] Configurar RLS para estudiantes
- [ ] Configurar RLS para administradores
- [ ] Crear bucket de adjuntos
- [ ] Configurar políticas de lectura
- [ ] Configurar políticas de escritura
- [ ] Verificar que `service_role` no se use desde el frontend

### Criterios de aceptación
- [ ] Un estudiante solo puede consultar sus propias solicitudes
- [ ] Un administrador puede consultar las solicitudes que gestiona
- [ ] Los archivos respetan las políticas de acceso
- [ ] La clave `service_role` no aparece en el código del frontend (solo en n8n)

---

## 6. Crear infraestructura base en Azure

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `infra` · **Milestone:** M1 - Avance jueves

### Descripción
Crear la infraestructura de Azure para alojar la instancia de n8n.

### Tareas
- [ ] Crear Resource Group `rg-solicitudes`
- [ ] Configurar presupuesto de Azure
- [ ] Crear VM (B2ats v2; B1s como alternativa)
- [ ] Usar Ubuntu Server 24.04 LTS
- [ ] Configurar IP pública estática
- [ ] Configurar etiqueta DNS
- [ ] Abrir puertos 80 y 443
- [ ] Restringir SSH al equipo (acceso por llave)

### Criterios de aceptación
- [ ] La VM está creada y accesible
- [ ] El servidor usa Ubuntu 24.04 LTS
- [ ] Tiene dirección pública
- [ ] Los puertos necesarios están configurados
- [ ] SSH funciona mediante llave
- [ ] Existe un presupuesto configurado en Azure

---

## 7. Preparar servidor para n8n

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `infra` · **Milestone:** M1 - Avance jueves

### Descripción
Preparar la VM para ejecutar n8n de forma estable y persistente.

### Tareas
- [ ] Actualizar Ubuntu
- [ ] Configurar zona horaria `America/Bogota`
- [ ] Crear swap de 2 GB
- [ ] Instalar Docker
- [ ] Instalar Docker Compose
- [ ] Ejecutar `docker run hello-world`
- [ ] Verificar espacio y memoria disponibles

### Criterios de aceptación
- [ ] Docker y Docker Compose funcionan
- [ ] El servidor tiene 2 GB de swap
- [ ] La zona horaria es `America/Bogota`
- [ ] `docker run hello-world` se ejecuta correctamente

---

## 8. Desplegar n8n con Docker

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `infra` · **Milestone:** M1 - Avance jueves

### Descripción
Desplegar la instancia compartida de n8n con Docker y persistencia de datos.

### Tareas
- [ ] Crear `docker-compose.yml`
- [ ] Fijar versión de n8n
- [ ] Configurar volumen persistente
- [ ] Configurar `N8N_HOST`, `N8N_PROTOCOL`, `WEBHOOK_URL`, `GENERIC_TIMEZONE`
- [ ] Configurar y respaldar `N8N_ENCRYPTION_KEY`
- [ ] Guardar secretos fuera de Git

### Criterios de aceptación
- [ ] n8n inicia con Docker Compose
- [ ] Los datos sobreviven a un reinicio del contenedor
- [ ] Las variables de entorno están configuradas
- [ ] `N8N_ENCRYPTION_KEY` está respaldada y no aparece en Git
- [ ] La versión de n8n está fijada

---

## 9. Configurar HTTPS para n8n

**Responsable:** David · **Prioridad:** 🔴 Alta · **Label:** `infra` · **Milestone:** M1 - Avance jueves

### Descripción
Configurar Caddy como proxy inverso para dar HTTPS a n8n (necesario para recibir webhooks de Supabase).

### Tareas
- [ ] Configurar Caddy y crear `Caddyfile`
- [ ] Asociar el DNS de Azure con n8n
- [ ] Configurar proxy inverso
- [ ] Obtener certificado HTTPS
- [ ] Verificar acceso externo

### Criterios de aceptación
- [ ] n8n es accesible por HTTPS con certificado válido
- [ ] La URL pública funciona desde fuera de Azure
- [ ] Los webhooks reciben solicitudes externas

---

## 10. Inicializar aplicación React

**Responsable:** Miguel · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Crear la aplicación base en React que funcionará como portal web.

### Tareas
- [ ] Crear proyecto React
- [ ] Configurar estructura de carpetas
- [ ] Configurar variables de entorno
- [ ] Configurar cliente de Supabase
- [ ] Crear estructura inicial de componentes
- [ ] Configurar routing

### Criterios de aceptación
- [ ] La aplicación inicia correctamente
- [ ] Las rutas principales están definidas
- [ ] Supabase se inicializa desde el frontend
- [ ] No hay credenciales privadas en el código

---

## 11. Implementar autenticación

**Responsable:** Miguel · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Implementar el inicio de sesión con Supabase Auth.

### Tareas
- [ ] Crear pantalla de login
- [ ] Implementar autenticación
- [ ] Manejar sesión activa
- [ ] Implementar cierre de sesión
- [ ] Redirigir usuarios autenticados
- [ ] Manejar errores de autenticación
- [ ] Diferenciar acceso según rol

### Criterios de aceptación
- [ ] Un usuario registrado puede iniciar sesión
- [ ] Un usuario no autenticado no accede al portal
- [ ] El usuario puede cerrar sesión
- [ ] Los errores se muestran claramente
- [ ] El sistema identifica el rol del usuario

---

## 12. Implementar dashboard del estudiante

**Responsable:** Miguel · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Crear la vista principal del estudiante para consultar sus solicitudes y su estado.

### Tareas
- [ ] Crear dashboard
- [ ] Consultar solicitudes del usuario autenticado
- [ ] Mostrar listado con tipo, asunto, estado y fecha
- [ ] Mostrar indicador de solicitudes pendientes
- [ ] Crear navegación hacia el detalle

### Criterios de aceptación
- [ ] El estudiante solo ve sus solicitudes
- [ ] Cada solicitud muestra su estado actual
- [ ] La información se obtiene desde Supabase
- [ ] El listado se actualiza después de crear una solicitud

---

## 13. Implementar formulario de nueva solicitud

**Responsable:** Miguel · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Pantalla para que el estudiante registre una nueva solicitud académica.

### Tareas
- [ ] Crear formulario
- [ ] Selector de tipo
- [ ] Campos de asunto y descripción
- [ ] Carga de archivo opcional
- [ ] Validar campos obligatorios
- [ ] Insertar solicitud en Supabase
- [ ] Asignar `estado = Pendiente` y `origen = web`
- [ ] Asociar solicitud al usuario autenticado

### Criterios de aceptación
- [ ] Un estudiante puede registrar una solicitud
- [ ] Los campos obligatorios se validan
- [ ] La solicitud se almacena con estado `Pendiente` y origen `web`
- [ ] El estudiante queda asociado correctamente
- [ ] Los adjuntos se almacenan cuando existen

---

## 14. Implementar dashboard administrativo

**Responsable:** José · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Vista administrativa para consultar y gestionar las solicitudes.

### Tareas
- [ ] Crear dashboard administrativo
- [ ] Consultar solicitudes
- [ ] Mostrar estudiante, tipo, estado y fecha
- [ ] Mostrar indicador `por_revisar`
- [ ] Crear navegación al detalle

### Criterios de aceptación
- [ ] Un administrador puede consultar las solicitudes
- [ ] La información relevante de cada caso es visible
- [ ] Las solicitudes `por_revisar` son fácilmente identificables
- [ ] Los estudiantes no acceden a esta vista

---

## 15. Implementar filtros de solicitudes

**Responsable:** José · **Prioridad:** 🟡 Media · **Label:** `frontend` · **Milestone:** M2 - MVP

### Descripción
Agregar filtros al dashboard administrativo.

### Tareas
- [ ] Filtrar por estado
- [ ] Filtrar por tipo
- [ ] Filtrar por fecha
- [ ] Filtrar solicitudes `por_revisar`
- [ ] Permitir limpiar filtros

### Criterios de aceptación
- [ ] Los filtros modifican correctamente el listado
- [ ] Se pueden combinar filtros
- [ ] Las `por_revisar` se identifican rápidamente
- [ ] Limpiar filtros devuelve el listado completo

---

## 16. Implementar gestión de estados y observaciones

**Responsable:** José · **Prioridad:** 🔴 Alta · **Label:** `frontend` · **Milestone:** M1 - Avance jueves

### Descripción
Permitir al administrador cambiar el estado de una solicitud y agregar observaciones.

### Tareas
- [ ] Crear selector de estado: `Pendiente`, `En proceso`, `Finalizada`, `Rechazada`
- [ ] Crear campo de observaciones
- [ ] Guardar cambios en Supabase
- [ ] Mostrar confirmación
- [ ] Mostrar errores

### Criterios de aceptación
- [ ] El administrador puede cambiar el estado
- [ ] Solo están disponibles los cuatro estados definidos
- [ ] Las observaciones se almacenan
- [ ] El cambio genera registro en el historial
- [ ] El estudiante puede ver el nuevo estado

---

## 17. Implementar historial de solicitudes

**Responsable:** José · **Prioridad:** 🟡 Media · **Label:** `frontend` · **Milestone:** M2 - MVP

### Descripción
Mostrar a administrador y estudiante la trazabilidad de cambios de una solicitud.

### Tareas
- [ ] Consultar `historial_estados`
- [ ] Mostrar fecha, estado anterior, estado nuevo y responsable
- [ ] Crear componente reutilizable de historial

### Criterios de aceptación
- [ ] El historial aparece en el detalle de la solicitud
- [ ] Los cambios están en orden cronológico
- [ ] Se muestra quién hizo cada cambio
- [ ] La información coincide con Supabase

---

## 18. Configurar credenciales de Supabase y SMTP

**Responsable:** Abel · **Prioridad:** 🔴 Alta · **Label:** `n8n` · **Milestone:** M1 - Avance jueves

### Descripción
Configurar en n8n las credenciales para Supabase y el envío de correos.

### Tareas
- [ ] Crear credencial Supabase (usar `service_role` solo en n8n)
- [ ] Configurar credencial SMTP
- [ ] Probar conexión con Supabase
- [ ] Probar envío de correo
- [ ] Crear webhook de prueba
- [ ] Verificar que las credenciales no se exporten a Git

### Criterios de aceptación
- [ ] n8n consulta, inserta y actualiza en Supabase
- [ ] n8n envía correos
- [ ] Ninguna contraseña aparece en el repositorio

---

## 19. Implementar F1 — Confirmación de registro

**Responsable:** Abel · **Prioridad:** 🔴 Alta · **Label:** `n8n` · **Milestone:** M1 - Avance jueves

### Descripción
Flujo que reacciona al registro de una nueva solicitud y envía los avisos.

### Tareas
- [ ] Crear webhook para INSERT de `solicitudes`
- [ ] Autenticar mediante encabezado secreto
- [ ] Obtener información de la solicitud y correo del estudiante
- [ ] Enviar confirmación al estudiante
- [ ] Enviar aviso al administrador
- [ ] Registrar envíos en `avisos_enviados`
- [ ] Exportar el flujo a `/n8n`

### Criterios de aceptación
- [ ] Una nueva solicitud activa el flujo
- [ ] El estudiante recibe confirmación y el administrador aviso
- [ ] Cada envío queda registrado
- [ ] El webhook rechaza solicitudes sin el encabezado secreto
- [ ] El flujo está exportado como JSON

---

## 20. Implementar F2 — Cambio de estado

**Responsable:** Abel · **Prioridad:** 🔴 Alta · **Label:** `n8n` · **Milestone:** M2 - MVP

### Descripción
Flujo que notifica al estudiante cuando cambia el estado de su solicitud.

### Tareas
- [ ] Crear webhook para UPDATE
- [ ] Comparar estado anterior y nuevo; continuar solo si cambió
- [ ] Obtener correo del estudiante y observaciones
- [ ] Enviar correo con el nuevo estado
- [ ] Registrar envío en `avisos_enviados`
- [ ] Exportar JSON

### Criterios de aceptación
- [ ] Un cambio de estado genera un correo con el nuevo estado y las observaciones
- [ ] Modificar otro campo no genera aviso
- [ ] El envío queda registrado

---

## 21. Implementar F3 — Recordatorio de solicitudes

**Responsable:** Santiago · **Prioridad:** 🟡 Media · **Label:** `n8n` · **Milestone:** M2 - MVP

### Descripción
Flujo programado que detecta solicitudes sin actualización por un periodo definido y envía recordatorio al responsable.

> ⚠️ Pendiente definir el número de días antes del recordatorio.

### Tareas
- [ ] Configurar disparador programado
- [ ] Definir número de días
- [ ] Consultar solicitudes sin actualización
- [ ] Identificar responsable
- [ ] Enviar recordatorio
- [ ] Registrar el aviso
- [ ] Evitar duplicados
- [ ] Exportar flujo a Git

### Criterios de aceptación
- [ ] El flujo se ejecuta según el horario definido
- [ ] Identifica solicitudes que superan el periodo
- [ ] Envía el recordatorio al responsable
- [ ] El envío queda registrado
- [ ] Solicitudes que no cumplen la condición no generan recordatorio

---

## 22. Configurar lectura de correos mediante IMAP

**Responsable:** Santiago · **Prioridad:** 🔴 Alta · **Label:** `n8n` · **Milestone:** M1 - Avance jueves

### Descripción
Configurar n8n para consultar periódicamente el buzón del proyecto.

### Tareas
- [ ] Configurar credencial IMAP
- [ ] Configurar lectura periódica
- [ ] Leer remitente, asunto y cuerpo
- [ ] Detectar adjuntos
- [ ] Identificar mensajes nuevos
- [ ] Leer un correo de prueba
- [ ] Crear estructura inicial del flujo F4

### Criterios de aceptación
- [ ] n8n se conecta al buzón
- [ ] Detecta correos nuevos
- [ ] Obtiene remitente, asunto y contenido
- [ ] Detecta adjuntos
- [ ] Los correos no se procesan repetidamente

---

## 23. Implementar F4 — Correo a caso

**Responsable:** Santiago · **Prioridad:** 🔴 Alta · **Label:** `n8n` · **Milestone:** M2 - MVP

### Descripción
Convertir solicitudes recibidas por correo en casos del sistema (`F4-correo-a-caso`).

### Tareas
- [ ] Leer correo mediante IMAP
- [ ] Identificar remitente y consultar si existe en `perfiles`
- [ ] Rechazar y responder a remitentes no registrados
- [ ] Extraer tipo, asunto y descripción
- [ ] Detectar adjuntos
- [ ] Crear solicitud con `origen = correo` y `estado = Pendiente`
- [ ] Marcar `por_revisar` si el tipo no puede identificarse
- [ ] Mover correo procesado a su carpeta
- [ ] Exportar flujo JSON

### Criterios de aceptación
- [ ] Un correo de usuario registrado crea una solicitud asociada al estudiante correcto
- [ ] La solicitud tiene `origen = correo` y estado `Pendiente`
- [ ] Un correo ambiguo genera una solicitud `por_revisar`
- [ ] Un remitente desconocido recibe respuesta y no genera solicitud
- [ ] El correo procesado se mueve a su carpeta
- [ ] La creación de la solicitud activa F1

---

## 24. Integrar frontend con Supabase

**Responsables:** Miguel + José · **Prioridad:** 🔴 Alta · **Label:** `integration` · **Milestone:** M2 - MVP

### Descripción
Conectar las interfaces del portal con Supabase para completar el flujo de creación y consulta.

### Tareas
- [ ] Conectar autenticación
- [ ] Conectar listado, creación y detalle de solicitudes
- [ ] Conectar actualización de estado y observaciones
- [ ] Verificar permisos RLS

### Criterios de aceptación
- [ ] El estudiante inicia sesión, crea y consulta sus solicitudes
- [ ] El administrador consulta solicitudes y cambia estados
- [ ] Se respetan los permisos de cada rol

---

## 25. Integrar Supabase con n8n

**Responsables:** David + Abel · **Prioridad:** 🔴 Alta · **Label:** `integration` · **Milestone:** M2 - MVP

### Descripción
Conectar los eventos de Supabase con los workflows de n8n.

### Tareas
- [ ] Configurar Database Webhooks (INSERT y UPDATE)
- [ ] Configurar encabezados secretos
- [ ] Verificar recepción, procesamiento y respuesta en n8n

### Criterios de aceptación
- [ ] Un INSERT activa F1
- [ ] Un UPDATE de estado activa F2
- [ ] Los webhooks solo aceptan solicitudes autenticadas
- [ ] Los flujos reciben la información necesaria

---

## 26. Primera integración React → Supabase → n8n

**Responsables:** Todos · **Prioridad:** 🔴 Alta · **Label:** `integration` · **Milestone:** M1 - Avance jueves

### Descripción
Demostrar para el avance un recorrido mínimo: crear una solicitud desde React, verla en Supabase y que n8n envíe la confirmación.

### Tareas
- [ ] Crear solicitud desde el formulario React
- [ ] Verificar el registro en Supabase
- [ ] Verificar que el webhook dispare F1
- [ ] Verificar recepción del correo de confirmación

### Criterios de aceptación
- [ ] El recorrido funciona de punta a punta sin intervención manual

---

## 27. Ejecutar recorrido completo del MVP

**Responsables:** Todos · **Prioridad:** 🔴 Alta · **Label:** `testing` · **Milestone:** M3 - Pruebas

### Descripción
Validar el recorrido completo desde la creación de una solicitud hasta su gestión y notificación.

### Tareas
- [ ] Registrar estudiante
- [ ] Crear solicitud desde React
- [ ] Verificar solicitud e historial en Supabase
- [ ] Verificar correo de confirmación
- [ ] Ingresar como administrador, cambiar estado y agregar observación
- [ ] Verificar nuevo registro en historial
- [ ] Verificar correo de cambio de estado
- [ ] Probar solicitud proveniente de correo
- [ ] Verificar recordatorio

### Criterios de aceptación
- [ ] El recorrido completo funciona sin intervención manual:

```text
Estudiante → React → Supabase → n8n → Correo → Administrador → Cambio de estado → n8n → Estudiante
```

---

## 28. Prueba de correo ambiguo y remitente desconocido

**Responsables:** Santiago + Abel · **Prioridad:** 🔴 Alta · **Label:** `testing` · **Milestone:** M3 - Pruebas

### Descripción
Validar que la automatización no tome decisiones incorrectas con información insuficiente o remitentes no registrados (la automatización no decide; lo ambiguo va a revisión humana).

### Tareas
- [ ] Enviar correo incompleto desde usuario registrado y verificar `por_revisar`
- [ ] Enviar correo desde usuario no registrado y verificar respuesta automática
- [ ] Verificar que no se cree solicitud para el desconocido

### Criterios de aceptación
- [ ] Los correos ambiguos no se descartan silenciosamente
- [ ] Las solicitudes ambiguas quedan `por_revisar`
- [ ] Los remitentes desconocidos reciben respuesta
- [ ] No se crean casos para usuarios no registrados

---

## 29. Documentar arquitectura del sistema

**Responsables:** Miguel + David · **Prioridad:** 🟡 Media · **Label:** `documentation` · **Milestone:** M4 - Cierre

### Descripción
Documentar la arquitectura técnica del MVP y la comunicación entre componentes.

### Tareas
- [ ] Crear diagrama de arquitectura
- [ ] Documentar React, Supabase, Azure y n8n
- [ ] Documentar SMTP, IMAP y webhooks
- [ ] Documentar flujo de datos

### Criterios de aceptación
- [ ] El diagrama representa la arquitectura implementada
- [ ] Se identifican todos los componentes y sus comunicaciones
- [ ] La documentación coincide con la implementación real

---

## 30. Documentar workflows de n8n

**Responsables:** Abel + Santiago · **Prioridad:** 🟡 Media · **Label:** `documentation` · **Milestone:** M4 - Cierre

### Descripción
Documentar los workflows del MVP y mantener sus versiones exportadas en Git.

### Tareas
- [ ] Exportar F1, F2, F3 y F4
- [ ] Agregar Sticky Note con propósito, responsable y fecha
- [ ] Revisar que los JSON no contengan secretos
- [ ] Crear commits identificables

### Criterios de aceptación
- [ ] Cada flujo tiene su JSON en `/n8n`
- [ ] Cada flujo tiene responsable y documentación interna
- [ ] Ningún JSON contiene credenciales
- [ ] La versión en Git corresponde a la versión funcional

---

## 31. Bot de navegador / RPA

**Responsable:** — · **Prioridad:** ⚪ Baja · **Label:** `n8n` · **Milestone:** Backlog

### Descripción
Fuera del alcance del MVP. Se deja registrado para una fase posterior; no debe consumir tiempo del avance actual.
