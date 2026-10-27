import { expect, test } from "@playwright/test"
import { API, cabecerasSecretas } from "./supabase-local"
import { USUARIOS, cambiarEstado, crearSolicitud, enlaceDe, esperarCorreo, sesion, unico } from "./utilidades"

// Cadena completa de avisos: web → Supabase (Database Webhook) → n8n (F1/F2 + Enviar-aviso) → correo.
// Requiere el entorno de n8n/local corriendo, con los flujos importados y scripts/webhooks.sh aplicado.
// Los correos llegan a Mailpit (http://127.0.0.1:54324).
const N8N = "http://127.0.0.1:5678/healthz/readiness"

async function avisos(solicitudId: string): Promise<{ tipo_aviso: string; destinatario: string; resultado: string }[]> {
  const respuesta = await fetch(`${API}/rest/v1/avisos_enviados?solicitud_id=eq.${solicitudId}&select=tipo_aviso,destinatario,resultado`, {
    headers: cabecerasSecretas,
  })
  return respuesta.json()
}

test.describe.serial("Avisos por correo (n8n)", () => {
  test.beforeAll(async () => {
    const listo = await fetch(N8N).then((r) => r.ok).catch(() => false)
    test.skip(!listo, "n8n local no está corriendo (ver n8n/local/README.md).")
  })

  const asunto = unico("Homologación de Cálculo Diferencial")
  let id = ""
  let desde: Date

  test("F1: registrar una solicitud avisa al estudiante y a la coordinación", async ({ browser }) => {
    desde = new Date(Date.now() - 1000)
    const ana = await sesion(browser, "ana")
    id = await crearSolicitud(ana, {
      tipo: "Homologación",
      asunto,
      descripcion: "Cursé Cálculo Diferencial en otra universidad y solicito su homologación.",
    })

    const alEstudiante = await esperarCorreo(USUARIOS.ana.correo, /Recibimos tu solicitud/, desde)
    expect(alEstudiante).toContain(asunto)
    expect(enlaceDe(alEstudiante, `/mis-solicitudes/${id}`)).toMatch(new RegExp(`^https?://[^/]+/mis-solicitudes/${id}$`))

    for (const persona of [USUARIOS.admin, USUARIOS.laura, USUARIOS.mateo]) {
      const aviso = await esperarCorreo(persona.correo, /Nueva solicitud: Homologación/, desde)
      expect(aviso).toContain(asunto)
      expect(enlaceDe(aviso, `/gestion/solicitudes/${id}`)).toContain(`/gestion/solicitudes/${id}`)
    }

    await expect.poll(async () => (await avisos(id)).length).toBe(4)
    expect((await avisos(id)).every((a) => a.resultado === "enviada")).toBe(true)
  })

  test("F2: tomar el caso no avisa; cambiar el estado sí, con la observación", async ({ browser }) => {
    const laura = await sesion(browser, "laura")
    await laura.goto(`/gestion/solicitudes/${id}`)
    await laura.getByRole("button", { name: "Tomar" }).click()
    await expect(laura.getByText("La solicitud quedó a tu cargo.")).toBeVisible()

    desde = new Date(Date.now() - 1000)
    await cambiarEstado(laura, "En proceso", "Revisamos el contenido programático <con> el comité.")
    await expect(laura.getByText("Estado actualizado.")).toBeVisible()

    const html = await esperarCorreo(USUARIOS.ana.correo, /Tu solicitud está en proceso/, desde)
    expect(html).toContain("La coordinación empezó a revisar tu solicitud.")
    // La observación va escapada: nada de HTML del personal o del estudiante sin escapar.
    expect(html).toContain("Revisamos el contenido programático &lt;con&gt; el comité.")
    expect(html).toContain("Pendiente → <strong>En proceso</strong>")

    // Solo un aviso de cambio de estado: tomar el caso (UPDATE sin cambio de estado) no avisa.
    await expect.poll(async () => (await avisos(id)).filter((a) => a.tipo_aviso === "cambio_estado").length).toBe(1)
  })

  test("F2: finalizar y reabrir llevan su propio mensaje", async ({ browser }) => {
    const laura = await sesion(browser, "laura")
    await laura.goto(`/gestion/solicitudes/${id}`)
    desde = new Date(Date.now() - 1000)
    await cambiarEstado(laura, "Finalizada", "Homologación aprobada.")
    const final = await esperarCorreo(USUARIOS.ana.correo, /Tu solicitud está finalizada/, desde)
    expect(final).toContain("Tu solicitud fue resuelta y el caso quedó cerrado.")

    const admin = await sesion(browser, "admin")
    await admin.goto(`/gestion/solicitudes/${id}`)
    desde = new Date(Date.now() - 1000)
    await cambiarEstado(admin, "Reabrir (En proceso)", "Falta la firma del director.")
    const reabierta = await esperarCorreo(USUARIOS.ana.correo, /Reabrimos tu solicitud/, desde)
    expect(reabierta).toContain("La coordinación reabrió tu solicitud.")
    expect(reabierta).toContain("Falta la firma del director.")
  })

  test("F2: retirar una solicitud avisa con su propio mensaje", async ({ browser }) => {
    const bruno = await sesion(browser, "bruno")
    const otra = await crearSolicitud(bruno, {
      tipo: "Reingreso",
      asunto: unico("Reingreso tras aplazamiento"),
      descripcion: "Aplacé el semestre pasado y solicito el reingreso para este periodo.",
    })
    desde = new Date(Date.now() - 1000)
    await bruno.getByRole("button", { name: "Retirar solicitud" }).click()
    await bruno.getByRole("button", { name: "Sí, retirar" }).click()
    await expect(bruno.getByText("Retiraste la solicitud.")).toBeVisible()

    const html = await esperarCorreo(USUARIOS.bruno.correo, /Tu solicitud está retirada/, desde)
    expect(html).toContain("Tu solicitud quedó retirada")
    expect(html).toContain("Pendiente → <strong>Retirada</strong>")
    await expect.poll(async () => (await avisos(otra)).map((a) => a.tipo_aviso).sort()).toContain("cambio_estado")
  })
})
