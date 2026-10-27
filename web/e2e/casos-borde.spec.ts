import { expect, test } from "@playwright/test"
import { API, cabecerasSecretas as cabeceras } from "./supabase-local"
import { iniciarSesion, unico } from "./utilidades"

test("una cuenta sin perfil no queda en un bucle de redirecciones", async ({ page }) => {
  // Cuenta confirmada cuyo perfil no existe (p. ej. creada antes del trigger al_confirmar_correo).
  const correo = `${unico("sin-perfil").replace(" ", "-")}@demo.test`
  const creado = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST",
    headers: cabeceras,
    body: JSON.stringify({ email: correo, password: "Prueba12345", email_confirm: true }),
  })
  expect(creado.ok).toBe(true)
  const { id } = (await creado.json()) as { id: string }
  const borrado = await fetch(`${API}/rest/v1/perfiles?id=eq.${id}`, { method: "DELETE", headers: cabeceras })
  expect(borrado.ok).toBe(true)

  await page.goto("/login")
  await page.getByLabel("Correo").fill(correo)
  await page.getByLabel("Contraseña", { exact: true }).fill("Prueba12345")
  await page.getByRole("button", { name: "Entrar" }).click()
  await expect(page.getByText("Tu cuenta no tiene un perfil activo")).toBeVisible()

  // Puede entrar con otra cuenta sin cerrar la sesión rota.
  await iniciarSesion(page, "ana")
  await expect(page).toHaveURL(/\/mis-solicitudes$/)

  await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: cabeceras })
})
