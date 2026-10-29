import { expect, test } from "@playwright/test"
import { consultar, enviarAlBuzon, esperarSolicitud, n8nCorriendo } from "./n8n-local"
import { USUARIOS, esperarCorreo, pdfDePrueba, sesion, unico } from "./utilidades"

// F4: correo al buzón del proyecto → solicitud. Requiere n8n/local corriendo con los flujos
// publicados y scripts/webhooks.sh aplicado (el INSERT de F4 dispara F1).
test.describe("F4: correo a caso", () => {
  test.beforeAll(async () => {
    test.skip(!(await n8nCorriendo()), "n8n local no está corriendo (ver n8n/local/README.md).")
  })

  test("el correo de un estudiante se convierte en solicitud con su adjunto", async ({ browser }, info) => {
    const desde = new Date(Date.now() - 1000)
    const asunto = unico("Solicitud de supletorio de Cálculo II")
    enviarAlBuzon(
      USUARIOS.ana.correo,
      asunto,
      "Buenas tardes. No pude presentar el parcial de Cálculo II por una cita médica. Adjunto la incapacidad.",
      { ruta: info.outputPath("incapacidad médica.pdf"), contenido: pdfDePrueba() }
    )

    const solicitud = await esperarSolicitud(asunto)
    expect(solicitud).toMatchObject({ tipo: "supletorio", origen: "correo", estado: "pendiente" })
    // Como las de la web, queda a cargo de un asesor.
    expect(solicitud.responsable_id).not.toBeNull()
    expect(solicitud.adjunto_path).toMatch(new RegExp(`/${solicitud.id}/incapacidad-medica\\.pdf$`))
    expect(solicitud.descripcion).toContain("por una cita médica")

    // El INSERT dispara F1: la confirmación le llega al estudiante como con una solicitud web.
    const confirmacion = await esperarCorreo(USUARIOS.ana.correo, /Recibimos tu solicitud/, desde)
    expect(confirmacion).toContain("por correo electrónico")

    // El estudiante la ve en la web, recibida por correo, y puede descargar el adjunto.
    const ana = await sesion(browser, "ana")
    await ana.goto(`/mis-solicitudes/${solicitud.id}`)
    await expect(ana.getByText("Recibida por correo").first()).toBeVisible()
    const descarga = ana.waitForEvent("download")
    await ana.getByRole("button", { name: "incapacidad-medica.pdf" }).click()
    expect((await descarga).suggestedFilename()).toBe("incapacidad-medica.pdf")
  })

  test("si no reconoce el trámite, la crea como Otro y el personal puede corregir el tipo", async ({ browser }) => {
    const asunto = unico("Consulta sobre mi situación académica")
    enviarAlBuzon(USUARIOS.bruno.correo, asunto, "Hola, quisiera saber qué opciones tengo con mi situación académica este semestre.")

    const solicitud = await esperarSolicitud(asunto)
    expect(solicitud.tipo).toBe("otro")

    const admin = await sesion(browser, "admin")
    await admin.goto(`/gestion/solicitudes/${solicitud.id}`)
    await admin.getByLabel("Tipo de solicitud").selectOption({ label: "Reingreso" })
    await admin.getByRole("button", { name: "Guardar tipo" }).click()
    await expect(admin.getByText("Clasificación guardada.")).toBeVisible()
  })

  test("si menciona varios trámites, toma el del asunto", async () => {
    const asunto = unico("Homologación de Programación I")
    enviarAlBuzon(
      USUARIOS.carla.correo,
      asunto,
      "Solicito la homologación. Si no procede, quisiera saber si puedo pedir supletorio del examen final."
    )
    const solicitud = await esperarSolicitud(asunto)
    expect(solicitud.tipo).toBe("homologacion")
  })

  test("si el asunto no dice el trámite, toma el primero que menciona el correo", async () => {
    const asunto = unico("Consulta urgente")
    enviarAlBuzon(USUARIOS.carla.correo, asunto, "Quisiera pedir un supletorio del final. Si no se puede, consideraría la cancelación.")
    const solicitud = await esperarSolicitud(asunto)
    expect(solicitud.tipo).toBe("supletorio")
  })

  test("anota al final de la descripción los adjuntos que no puede guardar", async ({}, info) => {
    const asunto = unico("Reingreso para el próximo semestre")
    enviarAlBuzon(USUARIOS.bruno.correo, asunto, "Solicito el reingreso. Adjunto la carta.", {
      ruta: info.outputPath("carta.docx"),
      contenido: Buffer.from("no es un pdf"),
    })
    const solicitud = await esperarSolicitud(asunto)
    expect(solicitud).toMatchObject({ tipo: "reingreso", adjunto_path: null })
    expect(solicitud.descripcion).toContain("[No se guardó: carta.docx")
  })

  test("a un remitente sin cuenta le responde cómo registrarse y no crea nada", async () => {
    const desde = new Date(Date.now() - 1000)
    const desconocido = `${unico("desconocido").replace(" ", "-")}@otro.test`
    const asunto = unico("Quiero pedir un supletorio")
    enviarAlBuzon(desconocido, asunto, "Hola, necesito un supletorio.")

    const respuesta = await esperarCorreo(desconocido, /No pudimos registrar tu solicitud/, desde)
    expect(respuesta).toContain("no corresponde a ninguna cuenta de estudiante")
    expect(respuesta).toContain("/registro")
    expect(await consultar(`solicitudes?asunto=eq.${encodeURIComponent(asunto)}&select=id`)).toHaveLength(0)
    const avisos = await consultar<{ solicitud_id: string | null; resultado: string }>(
      `avisos_enviados?tipo_aviso=eq.remitente_desconocido&destinatario=eq.${encodeURIComponent(desconocido)}&select=solicitud_id,resultado`
    )
    expect(avisos).toEqual([{ solicitud_id: null, resultado: "enviada" }])
  })

  test("al personal de la coordinación no le crea solicitudes", async () => {
    const desde = new Date(Date.now() - 1000)
    const asunto = unico("Supletorio de prueba del personal")
    enviarAlBuzon(USUARIOS.laura.correo, asunto, "Probando el buzón con un supletorio.")
    const respuesta = await esperarCorreo(USUARIOS.laura.correo, /No pudimos registrar tu solicitud/, desde)
    expect(respuesta).toContain("pertenece al personal de la coordinación")
    expect(await consultar(`solicitudes?asunto=eq.${encodeURIComponent(asunto)}&select=id`)).toHaveLength(0)
  })
})
