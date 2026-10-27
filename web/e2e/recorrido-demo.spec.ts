import { expect, test, type Page } from "@playwright/test"
import { USUARIOS, cambiarEstado, crearSolicitud, pdfDePrueba, sesion, unico } from "./utilidades"

// El guion de la demo, en orden: estudiante registra → asesora toma y gestiona → otro asesor no
// puede tocarla → estudiante ve el avance → admin reabre, reasigna y revisa la carga.
test.describe.serial("Recorrido de la demo", () => {
  const asunto = unico("Supletorio del parcial 2 de Bases de Datos")
  let id = ""
  let ana: Page
  let laura: Page

  test.beforeAll(async ({ browser }) => {
    ana = await sesion(browser, "ana")
    laura = await sesion(browser, "laura")
  })

  test("el formulario valida antes de enviar", async () => {
    await ana.goto("/mis-solicitudes/nueva")
    await ana.getByLabel("Asunto").fill("abc")
    await ana.getByLabel("Descripción").fill("corta")
    await ana.getByRole("button", { name: "Registrar solicitud" }).click()
    await expect(ana.getByText("Elige el tipo de solicitud.")).toBeVisible()
    await expect(ana.getByText("El asunto debe tener al menos 5 caracteres.")).toBeVisible()
    await expect(ana.getByText("Describe tu solicitud con al menos 20 caracteres.")).toBeVisible()
    // Lo escrito no se pierde.
    await expect(ana.getByLabel("Asunto")).toHaveValue("abc")
  })

  test("rechaza adjuntos que no son PDF, JPG o PNG", async () => {
    await ana.goto("/mis-solicitudes/nueva")
    await ana.getByLabel("Tipo de solicitud").selectOption({ label: "Supletorio" })
    await ana.getByLabel("Asunto").fill("Prueba de adjunto inválido")
    await ana.getByLabel("Descripción").fill("Descripción suficientemente larga para pasar la validación.")
    await ana.getByLabel("Adjunto (opcional)").setInputFiles({ name: "virus.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") })
    await ana.getByRole("button", { name: "Registrar solicitud" }).click()
    await expect(ana.getByText("Solo se aceptan archivos PDF, JPG o PNG.")).toBeVisible()
    await expect(ana).toHaveURL(/\/nueva$/)
  })

  test("1. la estudiante registra una solicitud con adjunto", async () => {
    id = await crearSolicitud(ana, {
      tipo: "Supletorio",
      asunto,
      descripcion: "No pude presentar el parcial por una cita médica. Adjunto la incapacidad.",
      adjunto: { nombre: "incapacidad médica.pdf", tipo: "application/pdf", contenido: pdfDePrueba() },
    })
    await expect(ana.getByRole("heading", { name: asunto })).toBeVisible()
    await expect(ana.getByText("Pendiente").first()).toBeVisible()
    await expect(ana.getByText("Solicitud registrada")).toBeVisible()
    // El nombre del archivo se normaliza (sin tildes ni espacios).
    await expect(ana.getByRole("button", { name: "incapacidad-medica.pdf" })).toBeVisible()

    // El aviso de "recién creada" no vuelve a salir al recargar: la página quita ?creada=1 de la URL.
    await expect(ana).not.toHaveURL(/creada=1/)
    await ana.reload()
    await expect(ana.getByText("Tu solicitud quedó registrada como Pendiente")).toHaveCount(0)

    await ana.goto("/mis-solicitudes")
    await expect(ana.getByRole("link", { name: asunto })).toBeVisible()
  })

  test("2. la asesora la ve sin asignar en la bandeja y la toma", async () => {
    await laura.goto(`/gestion?responsable=libres&q=${encodeURIComponent(asunto)}`)
    const fila = laura.getByRole("row").filter({ hasText: asunto })
    await expect(fila).toBeVisible()
    await fila.getByRole("button", { name: "Tomar" }).click()
    await expect(laura.getByText("La solicitud quedó a tu cargo.")).toBeVisible()
    // Ya no está libre: sale del filtro "Sin asignar" y aparece en "Mías".
    await expect(fila).toHaveCount(0)
    await laura.goto(`/gestion?responsable=mias&q=${encodeURIComponent(asunto)}`)
    await expect(laura.getByRole("row").filter({ hasText: asunto }).getByText("Tú")).toBeVisible()
  })

  test("3. otro asesor la ve en solo lectura", async ({ browser }) => {
    const mateo = await sesion(browser, "mateo")
    await mateo.goto(`/gestion/solicitudes/${id}`)
    await expect(mateo.getByText(`La atiende ${USUARIOS.laura.nombre}`)).toBeVisible()
    await expect(mateo.getByLabel("Nuevo estado")).toHaveCount(0)
    await mateo.context().close()
  })

  test("4. la asesora descarga el adjunto", async () => {
    await laura.goto(`/gestion/solicitudes/${id}`)
    const descarga = laura.waitForEvent("download")
    await laura.getByRole("button", { name: "incapacidad-medica.pdf" }).click()
    expect((await descarga).suggestedFilename()).toBe("incapacidad-medica.pdf")
  })

  test("5. rechazar sin observación no se permite", async () => {
    await laura.goto(`/gestion/solicitudes/${id}`)
    await cambiarEstado(laura, "Rechazada")
    await expect(laura.getByText("Explica al estudiante por qué se rechaza.")).toBeVisible()
    // Tras el error, el formulario sigue en "Rechazada" y la observación sigue marcada como obligatoria.
    await expect(laura.getByLabel("Nuevo estado")).toHaveValue("rechazada")
    await expect(laura.getByText("Motivo del rechazo (obligatorio)")).toBeVisible()
    await expect(laura.getByText("Pendiente").first()).toBeVisible()
  })

  test("6. la asesora la pasa a En proceso con una observación", async () => {
    await laura.goto(`/gestion/solicitudes/${id}`)
    await cambiarEstado(laura, "En proceso", "Recibimos la incapacidad. La validamos con el docente.")
    await expect(laura.getByText("Estado actualizado.")).toBeVisible()
    await expect(laura.getByText("Respuesta vigente al estudiante")).toBeVisible()
    const seguimiento = laura.locator("ol")
    await expect(seguimiento.getByText("Recibimos la incapacidad. La validamos con el docente.")).toBeVisible()
  })

  test("7. la estudiante ve el avance y ya no puede retirarla", async () => {
    await ana.goto(`/mis-solicitudes/${id}`)
    await expect(ana.getByText("En proceso").first()).toBeVisible()
    await expect(ana.getByText("Respuesta de la coordinación")).toBeVisible()
    await expect(ana.getByText("Recibimos la incapacidad. La validamos con el docente.").first()).toBeVisible()
    await expect(ana.getByRole("button", { name: "Retirar solicitud" })).toHaveCount(0)
    await expect(ana.getByText("¿Quieres desistir?")).toBeVisible()
    // En el seguimiento el estudiante no ve nombres del personal.
    await expect(ana.getByText("Coordinación académica").first()).toBeVisible()
  })

  test("8. la asesora la finaliza y queda cerrada", async () => {
    await laura.goto(`/gestion/solicitudes/${id}`)
    await cambiarEstado(laura, "Finalizada", "Supletorio aprobado para el martes a las 10:00.")
    await expect(laura.getByText("Solicitud cerrada")).toBeVisible()
    // El asesor no puede reabrir.
    await expect(laura.getByLabel("Nuevo estado")).toHaveCount(0)

    await ana.goto(`/mis-solicitudes/${id}`)
    await expect(ana.getByText("Finalizada").first()).toBeVisible()
    await expect(ana.getByText("Supletorio aprobado para el martes a las 10:00.").first()).toBeVisible()
  })

  test("9. el admin la reabre y la reasigna", async ({ browser }) => {
    const admin = await sesion(browser, "admin")
    await admin.goto(`/gestion/solicitudes/${id}`)
    await cambiarEstado(admin, "Reabrir (En proceso)")
    await expect(admin.getByText("Explica al estudiante por qué se reabre.")).toBeVisible()
    await cambiarEstado(admin, "Reabrir (En proceso)", "Se reabre: falta la firma del docente.")
    await expect(admin.getByText("Estado actualizado.")).toBeVisible()
    await expect(admin.getByText("En proceso").first()).toBeVisible()

    await admin.getByLabel("Reasignar a").selectOption({ label: `${USUARIOS.mateo.nombre} · Asesoría` })
    await admin.getByRole("button", { name: "Reasignar" }).click()
    await expect(admin.getByText("Responsable actualizado.")).toBeVisible()
    await expect(admin.getByText(USUARIOS.mateo.nombre).first()).toBeVisible()

    // Laura ya no puede gestionarla; Mateo sí.
    await laura.goto(`/gestion/solicitudes/${id}`)
    await expect(laura.getByText(`La atiende ${USUARIOS.mateo.nombre}`)).toBeVisible()
    const mateo = await sesion(browser, "mateo")
    await mateo.goto(`/gestion?responsable=mias&q=${encodeURIComponent(asunto)}`)
    await expect(mateo.getByRole("row").filter({ hasText: asunto })).toBeVisible()
    await mateo.context().close()
    await admin.context().close()
  })

  test("10. el admin ve la carga del equipo, las métricas y los roles", async ({ browser }) => {
    const admin = await sesion(browser, "admin")
    await expect(admin.getByRole("heading", { name: "Carga del equipo" })).toBeVisible()
    // Cada persona del equipo es un enlace a sus casos en la bandeja.
    await expect(admin.getByRole("link", { name: new RegExp(USUARIOS.laura.nombre) })).toBeVisible()
    await admin.getByRole("link", { name: new RegExp(USUARIOS.mateo.nombre) }).click()
    await expect(admin).toHaveURL(/\/gestion\?responsable=[0-9a-f-]{36}$/)
    await expect(admin.getByRole("link", { name: new RegExp(`${USUARIOS.mateo.nombre}.*\\(quitar filtro\\)`) })).toBeVisible()
    await admin.goto("/admin")

    await admin.goto("/admin/metricas")
    await expect(admin.getByRole("heading", { name: "Métricas" })).toBeVisible()
    await expect(admin.getByText("Tiempo promedio por tipo")).toBeVisible()
    await expect(admin.getByText("Todavía no hay datos.")).toHaveCount(0)

    await admin.goto("/admin/usuarios")
    await expect(admin.getByRole("heading", { name: "Roles del equipo" })).toBeVisible()
    await admin.context().close()
  })
})

test.describe("Otras situaciones de la demo", () => {
  test("la estudiante retira una solicitud pendiente", async ({ browser }) => {
    const bruno = await sesion(browser, "bruno")
    const asunto = unico("Cancelación extemporánea de Estadística")
    const id = await crearSolicitud(bruno, {
      tipo: "Cancelación extemporánea",
      asunto,
      descripcion: "Solicito cancelar Estadística por motivos laborales que me impiden asistir.",
    })
    await bruno.getByRole("button", { name: "Retirar solicitud" }).click()
    await bruno.getByRole("button", { name: "Sí, retirar" }).click()
    await expect(bruno.getByText("Retiraste la solicitud.")).toBeVisible()
    await expect(bruno.getByText("Retirada").first()).toBeVisible()
    await expect(bruno.getByRole("button", { name: "Retirar solicitud" })).toHaveCount(0)

    const laura = await sesion(browser, "laura")
    await laura.goto(`/gestion/solicitudes/${id}`)
    await expect(laura.getByText("Solicitud cerrada")).toBeVisible()
  })

  test("la asesora confirma la clasificación de un caso por revisar", async ({ browser }) => {
    const laura = await sesion(browser, "laura")
    await laura.goto("/gestion?revision=por_revisar&responsable=libres")
    // La tabla llega por streaming: esperar a que haya filas o el aviso de vacío antes de contar.
    await expect(laura.locator("tbody tr").first().or(laura.getByText("Ninguna solicitud coincide"))).toBeVisible()
    const fila = laura.getByRole("row").filter({ hasText: "Por revisar" }).first()
    test.skip((await fila.count()) === 0, "No quedan casos por revisar libres (corre `supabase db reset`).")
    await fila.getByRole("link").first().click()
    await expect(laura.getByText("Clasificación por revisar")).toBeVisible()
    await laura.getByLabel("Tipo de solicitud").selectOption({ label: "Reingreso" })
    await laura.getByRole("button", { name: "Confirmar tipo y marcar revisada" }).click()
    await expect(laura.getByText("Clasificación guardada.")).toBeVisible()
    await expect(laura.getByText("Clasificación por revisar")).toHaveCount(0)
    // Clasificar un caso libre también lo toma.
    await expect(laura.getByText("Tú", { exact: true })).toBeVisible()
  })

  test("la bandeja filtra por estado, tipo y texto", async ({ browser }) => {
    const laura = await sesion(browser, "laura")
    await laura.getByRole("link", { name: /^Finalizada/ }).click()
    await expect(laura).toHaveURL(/estado=finalizada/)
    const filas = laura.locator("tbody tr")
    await expect(filas.first()).toBeVisible()
    for (const texto of await filas.allInnerTexts()) expect(texto).toContain("Finalizada")

    await laura.getByLabel("Tipo").selectOption({ label: "Supletorio" })
    await expect(laura).toHaveURL(/tipo=supletorio/)
    await laura.getByRole("searchbox").fill("texto-que-no-existe-xyz")
    await laura.getByRole("searchbox").press("Enter")
    await expect(laura.getByText("Ninguna solicitud coincide con los filtros.")).toBeVisible()
    await laura.getByRole("link", { name: "Limpiar filtros" }).click()
    await expect(laura).toHaveURL(/\/gestion$/)
  })

  test("el admin da y quita el rol de asesor", async ({ browser }) => {
    const admin = await sesion(browser, "admin")
    await admin.goto("/admin/usuarios")
    await admin.getByRole("searchbox").fill("carla")
    const fila = admin.getByRole("listitem").filter({ hasText: "carla.rios@demo.test" })
    await fila.getByRole("button", { name: "Hacer asesor" }).click()
    await expect(admin.getByText("Carla Ríos ahora es asesor.")).toBeVisible()

    const equipo = admin.getByRole("listitem").filter({ hasText: "carla.rios@demo.test" }).first()
    await equipo.getByRole("button", { name: "Quitar rol" }).click()
    await admin.getByRole("alertdialog").getByRole("button", { name: "Quitar rol" }).click()
    await expect(admin.getByText("Carla Ríos volvió a ser estudiante.")).toBeVisible()
  })
})
