import { expect, type Browser, type Page } from "@playwright/test"

// Usuarios de supabase/seed.sql. Todos con la misma contraseña.
export const CLAVE = "Demo12345"
export const USUARIOS = {
  admin: { correo: "admin@demo.test", nombre: "Coordinación Académica" },
  laura: { correo: "laura.ospina@demo.test", nombre: "Laura Ospina" },
  mateo: { correo: "mateo.restrepo@demo.test", nombre: "Mateo Restrepo" },
  ana: { correo: "ana.gomez@demo.test", nombre: "Ana Gómez" },
  bruno: { correo: "bruno.diaz@demo.test", nombre: "Bruno Díaz" },
  carla: { correo: "carla.rios@demo.test", nombre: "Carla Ríos" },
} as const

export type Usuario = keyof typeof USUARIOS

// La clave de USUARIOS que corresponde a un correo.
export function usuarioDe(correo: string | null): Usuario {
  const usuario = (Object.keys(USUARIOS) as Usuario[]).find((u) => USUARIOS[u].correo === correo)
  if (!usuario) throw new Error(`No hay un usuario de prueba con el correo ${correo}`)
  return usuario
}

const MAILPIT = "http://127.0.0.1:54324/api/v1"

// Asuntos únicos: las pruebas no dependen de que la base esté recién reseteada.
export function unico(prefijo: string): string {
  return `${prefijo} ${Date.now().toString(36)}`
}

export async function iniciarSesion(page: Page, usuario: Usuario | string, clave = CLAVE) {
  const correo = usuario in USUARIOS ? USUARIOS[usuario as Usuario].correo : usuario
  await page.goto("/login")
  await page.getByLabel("Correo").fill(correo)
  await page.getByLabel("Contraseña", { exact: true }).fill(clave)
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

// Una pestaña con su propia sesión, para tener a varias personas a la vez en la misma prueba.
export async function sesion(browser: Browser, usuario: Usuario): Promise<Page> {
  const contexto = await browser.newContext()
  const page = await contexto.newPage()
  await iniciarSesion(page, usuario)
  return page
}

type NuevaSolicitud = { tipo: string; asunto: string; descripcion: string; adjunto?: { nombre: string; tipo: string; contenido: Buffer } }

// Registra una solicitud desde el formulario del estudiante y devuelve su id.
export async function crearSolicitud(page: Page, datos: NuevaSolicitud): Promise<string> {
  await page.goto("/mis-solicitudes/nueva")
  await page.getByLabel("Tipo de solicitud").selectOption({ label: datos.tipo })
  await page.getByLabel("Asunto").fill(datos.asunto)
  await page.getByLabel("Descripción").fill(datos.descripcion)
  if (datos.adjunto) {
    await page.getByLabel("Adjunto (opcional)").setInputFiles({
      name: datos.adjunto.nombre,
      mimeType: datos.adjunto.tipo,
      buffer: datos.adjunto.contenido,
    })
  }
  await page.getByRole("button", { name: "Registrar solicitud" }).click()
  await expect(page).toHaveURL(/\/mis-solicitudes\/[0-9a-f-]{36}/)
  await expect(page.getByText("Tu solicitud quedó registrada como Pendiente")).toBeVisible()
  return page.url().match(/[0-9a-f-]{36}/)![0]
}

// PDF mínimo válido, suficiente para el bucket (solo revisa el tipo y el tamaño).
export function pdfDePrueba(): Buffer {
  return Buffer.from(
    "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n" +
      "trailer<</Root 1 0 R>>\n%%EOF\n"
  )
}

// Cambia el estado desde el panel Gestión de /gestion/solicitudes/[id].
export async function cambiarEstado(page: Page, estado: string, observacion?: string) {
  await page.getByLabel("Nuevo estado").selectOption({ label: estado })
  if (observacion !== undefined) await page.locator("#observacion").fill(observacion)
  await page.getByRole("button", { name: /Cambiar estado|Reabrir solicitud/ }).click()
}

// ---- Mailpit: la bandeja de correos del Supabase local ----------------------------------------

type Mensaje = { ID: string; Subject: string; To: { Address: string }[]; Created: string }

export async function correosPara(destinatario: string, desde?: Date): Promise<Mensaje[]> {
  const respuesta = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${destinatario}"`)}&limit=50`)
  const { messages } = (await respuesta.json()) as { messages: Mensaje[] }
  return messages.filter((m) => !desde || new Date(m.Created) >= desde)
}

// Espera un correo (los envía Supabase Auth o n8n, ambos asíncronos) y devuelve su HTML.
export async function esperarCorreo(destinatario: string, asunto: RegExp, desde: Date): Promise<string> {
  let html = ""
  await expect
    .poll(
      async () => {
        try {
          const mensaje = (await correosPara(destinatario, desde)).find((m) => asunto.test(m.Subject))
          if (!mensaje) return false
          const detalle = (await (await fetch(`${MAILPIT}/message/${mensaje.ID}`)).json()) as { HTML: string }
          html = detalle.HTML
          return true
        } catch {
          // Mailpit a veces corta una conexión: se reintenta en la siguiente vuelta.
          return false
        }
      },
      { timeout: 20_000, message: `correo "${asunto}" para ${destinatario}` }
    )
    .toBe(true)
  return html
}

export function enlaceDe(html: string, contiene: string): string {
  const enlace = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replaceAll("&amp;", "&")).find((h) => h.includes(contiene))
  if (!enlace) throw new Error(`No hay enlace con "${contiene}" en el correo`)
  return enlace
}
