import { expect, test } from "@playwright/test"
import { API, PUBLICA } from "./supabase-local"
import { USUARIOS, crearSolicitud, sesion, unico } from "./utilidades"

// Token de un usuario, como lo tendría su navegador.
async function token(correo: string): Promise<string> {
  const respuesta = await fetch(`${API}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: PUBLICA, "Content-Type": "application/json" },
    body: JSON.stringify({ email: correo, password: "Demo12345" }),
  })
  return ((await respuesta.json()) as { access_token: string }).access_token
}

// Lo mismo que hace tomarSolicitud(): update con el filtro responsable_id is null.
async function tomar(acceso: string, solicitudId: string, usuarioId: string) {
  const respuesta = await fetch(`${API}/rest/v1/solicitudes?id=eq.${solicitudId}&responsable_id=is.null`, {
    method: "PATCH",
    headers: {
      apikey: PUBLICA,
      Authorization: `Bearer ${acceso}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ responsable_id: usuarioId }),
  })
  return (await respuesta.json()) as unknown[]
}

function sub(jwt: string): string {
  return JSON.parse(Buffer.from(jwt.split(".")[1], "base64url").toString()).sub
}

test("dos asesores toman el mismo caso a la vez: solo uno lo obtiene", async ({ browser }) => {
  const ana = await sesion(browser, "ana")
  const id = await crearSolicitud(ana, {
    tipo: "Supletorio",
    asunto: unico("Supletorio de Álgebra Lineal"),
    descripcion: "Solicito supletorio del examen final de Álgebra Lineal por calamidad doméstica.",
  })

  const [laura, mateo] = await Promise.all([token(USUARIOS.laura.correo), token(USUARIOS.mateo.correo)])
  // Varias rondas en paralelo para que de verdad compitan por el bloqueo de la fila.
  const resultados = await Promise.all([
    tomar(laura, id, sub(laura)),
    tomar(mateo, id, sub(mateo)),
    tomar(laura, id, sub(laura)),
    tomar(mateo, id, sub(mateo)),
  ])
  expect(resultados.filter((filas) => filas.length === 1)).toHaveLength(1)
})

test("la bandeja se actualiza sola cuando otro asesor toma un caso", async ({ browser }) => {
  const ana = await sesion(browser, "ana")
  const asunto = unico("Excepción de prerrequisito")
  const id = await crearSolicitud(ana, {
    tipo: "Solicitud al comité curricular",
    asunto,
    descripcion: "Solicito excepción de prerrequisito para inscribir Sistemas Empresariales este semestre.",
  })

  const laura = await sesion(browser, "laura")
  await laura.goto(`/gestion?q=${encodeURIComponent(asunto)}`)
  const fila = laura.getByRole("row").filter({ hasText: asunto })
  await expect(fila.getByRole("button", { name: "Tomar" })).toBeVisible()
  // Darle tiempo al canal de Realtime para suscribirse antes del cambio.
  await laura.waitForTimeout(1500)

  const mateo = await sesion(browser, "mateo")
  await mateo.goto(`/gestion/solicitudes/${id}`)
  await mateo.getByRole("button", { name: "Tomar" }).click()
  await expect(mateo.getByText("La solicitud quedó a tu cargo.")).toBeVisible()

  // Sin recargar: la fila de Laura ya muestra a Mateo y no ofrece "Tomar".
  await expect(fila.getByText(USUARIOS.mateo.nombre)).toBeVisible({ timeout: 15_000 })
  await expect(fila.getByRole("button", { name: "Tomar" })).toHaveCount(0)
})
