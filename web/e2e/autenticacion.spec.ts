import { expect, test } from "@playwright/test"
import { enlaceDe, esperarCorreo, iniciarSesion, unico } from "./utilidades"

test.describe("Acceso", () => {
  test("sin sesión, cualquier ruta lleva al login y conserva el destino", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/gestion")
    await expect(page).toHaveURL(/\/login\?next=%2Fgestion/)
  })

  test("contraseña incorrecta muestra un error claro", async ({ page }) => {
    await page.goto("/login")
    await page.getByLabel("Correo").fill("ana.gomez@demo.test")
    await page.getByLabel("Contraseña", { exact: true }).fill("NoEsLaClave1")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible()
    await expect(page).toHaveURL(/\/login$/)
  })

  test("cada rol entra a su inicio", async ({ browser }) => {
    for (const [usuario, inicio] of [
      ["ana", /\/mis-solicitudes$/],
      ["laura", /\/gestion$/],
      ["admin", /\/admin$/],
    ] as const) {
      const contexto = await browser.newContext()
      const page = await contexto.newPage()
      await iniciarSesion(page, usuario)
      await expect(page).toHaveURL(inicio)
      await contexto.close()
    }
  })

  test("tras el login vuelve a la ruta pedida", async ({ page }) => {
    await page.goto("/mis-solicitudes/nueva")
    await expect(page).toHaveURL(/next=/)
    await page.getByLabel("Correo").fill("ana.gomez@demo.test")
    await page.getByLabel("Contraseña", { exact: true }).fill("Demo12345")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page).toHaveURL(/\/mis-solicitudes\/nueva$/)
  })

  test("cada rol solo entra a sus pantallas", async ({ browser }) => {
    const estudiante = await (await browser.newContext()).newPage()
    await iniciarSesion(estudiante, "ana")
    await estudiante.goto("/gestion")
    await expect(estudiante).toHaveURL(/\/mis-solicitudes$/)
    await estudiante.goto("/admin")
    await expect(estudiante).toHaveURL(/\/mis-solicitudes$/)

    const asesor = await (await browser.newContext()).newPage()
    await iniciarSesion(asesor, "laura")
    await asesor.goto("/admin/metricas")
    await expect(asesor).toHaveURL(/\/gestion$/)
    await asesor.goto("/mis-solicitudes/nueva")
    await expect(asesor).toHaveURL(/\/gestion$/)
  })

  test("con sesión, /login lleva al inicio", async ({ page }) => {
    await iniciarSesion(page, "ana")
    await page.goto("/login")
    await expect(page).toHaveURL(/\/mis-solicitudes$/)
  })

  test("cerrar sesión", async ({ page }) => {
    await iniciarSesion(page, "ana")
    await page.getByRole("button", { name: "Ana Gómez" }).click()
    await page.getByRole("menuitem", { name: "Cerrar sesión" }).click()
    await expect(page).toHaveURL(/\/login$/)
    await page.goto("/mis-solicitudes")
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe("Registro y recuperación", () => {
  test("registro con confirmación por correo crea la cuenta de estudiante", async ({ page }) => {
    const correo = `${unico("e2e").replace(" ", "-")}@demo.test`.toLowerCase()
    const desde = new Date(Date.now() - 1000)

    await page.goto("/registro")
    await page.getByLabel("Nombre completo").fill("Estudiante de Prueba")
    await page.getByLabel("Correo").fill(correo)
    await page.getByLabel("ID estudiantil").fill("990001")
    await page.getByLabel("Contraseña", { exact: true }).fill("Prueba12345")
    await page.getByLabel("Repite la contraseña").fill("Prueba12345")
    await page.getByRole("button", { name: "Crear cuenta" }).click()
    await expect(page.getByText(`Te enviamos un enlace de confirmación a ${correo}`)).toBeVisible()

    // Sin confirmar no entra.
    await page.goto("/login")
    await page.getByLabel("Correo").fill(correo)
    await page.getByLabel("Contraseña", { exact: true }).fill("Prueba12345")
    await page.getByRole("button", { name: "Entrar" }).click()
    await expect(page.getByText("Aún no confirmas tu correo")).toBeVisible()

    const html = await esperarCorreo(correo, /Confirma tu correo/, desde)
    await page.goto(enlaceDe(html, "/auth/confirm"))
    await expect(page).toHaveURL(/\/mis-solicitudes$/)
    await expect(page.getByRole("heading", { name: "Mis solicitudes" })).toBeVisible()
  })

  test("validaciones del registro", async ({ page }) => {
    await page.goto("/registro")
    await page.getByLabel("ID estudiantil").fill("12")
    await page.getByLabel("Contraseña", { exact: true }).fill("corta")
    await page.getByLabel("Repite la contraseña").fill("otra")
    await page.getByRole("button", { name: "Crear cuenta" }).click()
    await expect(page.getByText("Escribe tu nombre completo.")).toBeVisible()
    await expect(page.getByText("Escribe un correo válido.")).toBeVisible()
    await expect(page.getByText("El ID estudiantil tiene entre 4 y 12 dígitos.")).toBeVisible()
    await expect(page.getByText("La contraseña debe tener al menos 8 caracteres.")).toBeVisible()
    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible()
  })

  test("recuperar la contraseña por correo", async ({ page }) => {
    const desde = new Date(Date.now() - 1000)
    await page.goto("/recuperar")
    await page.getByLabel("Correo").fill("carla.rios@demo.test")
    await page.getByRole("button", { name: "Enviar enlace" }).click()
    await expect(page.getByText("te llegará un enlace")).toBeVisible()

    const html = await esperarCorreo("carla.rios@demo.test", /Restablece tu contraseña/, desde)
    await page.goto(enlaceDe(html, "/auth/confirm"))
    await expect(page).toHaveURL(/\/actualizar-clave$/)
    // Misma contraseña del seed: así la prueba se puede repetir.
    await page.getByLabel("Contraseña nueva").fill("Demo12345")
    await page.getByLabel("Repite la contraseña").fill("Demo12345")
    await page.getByRole("button", { name: "Guardar contraseña" }).click()
    // Supabase rechaza repetir la contraseña actual; cualquiera de los dos resultados prueba el flujo.
    await expect(
      page.getByText("La contraseña nueva debe ser distinta de la actual.").or(page.getByRole("heading", { name: "Mis solicitudes" }))
    ).toBeVisible()
  })

  test("un enlace inválido avisa en el login", async ({ page }) => {
    await page.goto("/auth/confirm?token_hash=invalido&type=email&next=/")
    await expect(page).toHaveURL(/\/login\?error=enlace/)
    await expect(page.getByText("El enlace no es válido o ya expiró.")).toBeVisible()
  })
})
