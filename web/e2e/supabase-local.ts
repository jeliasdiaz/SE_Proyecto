// Acceso directo al Supabase LOCAL para preparar datos y revisar resultados que la interfaz no
// muestra. Las llaves las pone playwright.config.ts (salen de `supabase status`): no van en el código.
export const API = "http://127.0.0.1:54321"
export const SECRETA = process.env.SUPABASE_SECRET_KEY!
export const PUBLICA = process.env.SUPABASE_PUBLISHABLE_KEY!

// La llave secreta salta RLS: solo para preparar o comprobar, nunca para lo que se está probando.
export const cabecerasSecretas = { apikey: SECRETA, Authorization: `Bearer ${SECRETA}`, "Content-Type": "application/json" }

async function leer<T>(ruta: string): Promise<T[]> {
  const respuesta = await fetch(`${API}/rest/v1/${ruta}`, { headers: cabecerasSecretas })
  if (!respuesta.ok) throw new Error(await respuesta.text())
  return respuesta.json()
}

// Correo del responsable de una solicitud; null si quedó sin asignar.
export async function responsableDe(solicitudId: string): Promise<string | null> {
  const [fila] = await leer<{ responsable: { correo: string } | null }>(
    `solicitudes?id=eq.${solicitudId}&select=responsable:perfiles!solicitudes_responsable_id_fkey(correo)`
  )
  return fila?.responsable?.correo ?? null
}

// Solicitudes abiertas de cada asesor, por correo: lo que mira asignar_responsable() en la base.
export async function cargaDeAsesores(): Promise<Map<string, number>> {
  const asesores = await leer<{ id: string; correo: string }>("perfiles?rol=eq.asesor&select=id,correo")
  const abiertas = await leer<{ responsable_id: string }>(
    "solicitudes?estado=in.(pendiente,en_proceso)&responsable_id=not.is.null&select=responsable_id"
  )
  return new Map(asesores.map((a) => [a.correo, abiertas.filter((s) => s.responsable_id === a.id).length]))
}

// Deja una solicitud sin responsable, como cuando el admin la libera.
export async function liberar(solicitudId: string) {
  const respuesta = await fetch(`${API}/rest/v1/solicitudes?id=eq.${solicitudId}`, {
    method: "PATCH",
    headers: cabecerasSecretas,
    body: JSON.stringify({ responsable_id: null }),
  })
  if (!respuesta.ok) throw new Error(await respuesta.text())
}
