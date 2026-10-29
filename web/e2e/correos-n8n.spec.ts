import { expect, test } from "@playwright/test"
import { API, cabecerasSecretas, responsableDe } from "./supabase-local"
import { USUARIOS, cambiarEstado, crearSolicitud, enlaceDe, esperarCorreo, sesion, unico, usuarioDe, type Usuario } from "./utilidades"

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
  let asesor: Usuario
  let desde: Date

  test("F1: registrar una solicitud avisa al estudiante y al asesor asignado", async ({ browser }) => {
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

    expect(alEstudiante).toContain("ya tiene un asesor de la coordinación a cargo")

    // Solo al asesor que la recibió, no a todo el personal.
    asesor = usuarioDe(await responsableDe(id))
    const aviso = await esperarCorreo(USUARIOS[asesor].correo, /Se te asignó una solicitud: Homologación/, desde)
    expect(aviso).toContain(asunto)
    expect(aviso).toContain("quedó a tu cargo")
    expect(enlaceDe(aviso, `/gestion/solicitudes/${id}`)).toContain(`/gestion/solicitudes/${id}`)

    await expect.poll(async () => (await avisos(id)).length).toBe(2)
    expect((await avisos(id)).every((a) => a.resultado === "enviada")).toBe(true)
  })

  test("F2: corregir el tipo no avisa; cambiar el estado sí, con la observación", async ({ browser }) => {
    const pagina = await sesion(browser, asesor)
    await pagina.goto(`/gestion/solicitudes/${id}`)
    await pagina.getByRole("button", { name: "Guardar tipo" }).click()
    await expect(pagina.getByText("Clasificación guardada.")).toBeVisible()

    desde = new Date(Date.now() - 1000)
    await cambiarEstado(pagina, "En proceso", "Revisamos el contenido programático <con> el comité.")
    await expect(pagina.getByText("Estado actualizado.")).toBeVisible()

    const html = await esperarCorreo(USUARIOS.ana.correo, /Tu solicitud está en proceso/, desde)
    expect(html).toContain("La coordinación empezó a revisar tu solicitud.")
    // La observación va escapada: nada de HTML del personal o del estudiante sin escapar.
    expect(html).toContain("Revisamos el contenido programático &lt;con&gt; el comité.")
    expect(html).toContain("Pendiente → <strong>En proceso</strong>")

    // Solo un aviso de cambio de estado: guardar el tipo (UPDATE sin cambio de estado) no avisa.
    await expect.poll(async () => (await avisos(id)).filter((a) => a.tipo_aviso === "cambio_estado").length).toBe(1)
  })

  test("F2: finalizar y reabrir llevan su propio mensaje", async ({ browser }) => {
    const pagina = await sesion(browser, asesor)
    await pagina.goto(`/gestion/solicitudes/${id}`)
    desde = new Date(Date.now() - 1000)
    await cambiarEstado(pagina, "Finalizada", "Homologación aprobada.")
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
