import { execFileSync } from "node:child_process"
import { writeFileSync } from "node:fs"
import path from "node:path"
import { expect } from "@playwright/test"
import { API, cabecerasSecretas } from "./supabase-local"

// Ayudas para las pruebas de F3 y F4 contra el entorno de n8n/local.
const N8N_LOCAL = path.resolve(__dirname, "../../n8n/local")

export async function n8nCorriendo(): Promise<boolean> {
  return fetch("http://127.0.0.1:5678/healthz/readiness").then((r) => r.ok).catch(() => false)
}

// Deja un correo en el buzón del proyecto (GreenMail), que F4 lee por IMAP.
export function enviarAlBuzon(remitente: string, asunto: string, cuerpo: string, adjunto?: { ruta: string; contenido: Buffer }) {
  const argumentos = [remitente, asunto, cuerpo]
  if (adjunto) {
    writeFileSync(adjunto.ruta, adjunto.contenido)
    argumentos.push(adjunto.ruta)
  }
  // Con bash explícito: en Windows no se puede ejecutar un .sh directamente.
  execFileSync("bash", ["scripts/correo-prueba.sh", ...argumentos], { cwd: N8N_LOCAL, stdio: "pipe" })
}

// Ejecuta un flujo como el botón "Ejecutar ahora". Otro puerto para el broker de tareas: el n8n que
// está corriendo ya ocupa el de siempre.
export function ejecutarFlujo(id: string) {
  const salida = execFileSync(
    "docker",
    ["compose", "exec", "-T", "-e", "N8N_RUNNERS_BROKER_PORT=5690", "n8n", "n8n", "execute", `--id=${id}`],
    { cwd: N8N_LOCAL, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  )
  expect(salida).toContain('"status": "success"')
}

export async function consultar<T>(ruta: string): Promise<T[]> {
  const respuesta = await fetch(`${API}/rest/v1/${ruta}`, { headers: cabecerasSecretas })
  expect(respuesta.ok, await respuesta.clone().text()).toBe(true)
  return respuesta.json()
}

export async function borrar(ruta: string) {
  const respuesta = await fetch(`${API}/rest/v1/${ruta}`, { method: "DELETE", headers: cabecerasSecretas })
  expect(respuesta.ok).toBe(true)
}

export type Solicitud = {
  id: string
  estudiante_id: string
  tipo: string
  asunto: string
  descripcion: string
  origen: string
  responsable_id: string | null
  adjunto_path: string | null
  estado: string
}

// Espera a que F4 cree la solicitud con ese asunto (IMAP tarda unos segundos en avisar).
export async function esperarSolicitud(asunto: string): Promise<Solicitud> {
  let encontrada: Solicitud | undefined
  await expect
    .poll(
      async () => {
        ;[encontrada] = await consultar<Solicitud>(`solicitudes?asunto=eq.${encodeURIComponent(asunto)}&select=*`)
        return Boolean(encontrada)
      },
      { timeout: 45_000, message: `F4 no creó la solicitud "${asunto}"` }
    )
    .toBe(true)
  return encontrada!
}
