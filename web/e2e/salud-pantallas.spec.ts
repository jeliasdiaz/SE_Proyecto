import { expect, test, type Page } from "@playwright/test"
import { iniciarSesion, type Usuario } from "./utilidades"

// Recorre cada pantalla de cada rol en escritorio y en móvil: sin errores en la consola, sin
// errores de servidor y sin desplazamiento horizontal (en la demo pueden proyectarla o abrirla
// en un celular).
const PANTALLAS: Record<Usuario | "anonimo", string[]> = {
  anonimo: ["/login", "/registro", "/recuperar"],
  ana: ["/mis-solicitudes", "/mis-solicitudes/nueva"],
  laura: ["/gestion", "/gestion?estado=en_proceso", "/gestion?responsable=mias"],
  admin: ["/admin", "/admin/metricas", "/admin/usuarios", "/gestion"],
  mateo: [],
  bruno: [],
  carla: [],
}

const ANCHOS = { escritorio: { width: 1280, height: 800 }, movil: { width: 390, height: 844 } }

async function revisar(page: Page, ruta: string) {
  const errores: string[] = []
  page.on("console", (m) => m.type() === "error" && errores.push(m.text()))
  page.on("pageerror", (e) => errores.push(e.message))
  const respuesta = await page.goto(ruta)
  expect(respuesta?.status(), `${ruta} respondió ${respuesta?.status()}`).toBeLessThan(400)
  await page.waitForLoadState("networkidle")
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(desborde, `${ruta} se desborda ${desborde}px a lo ancho`).toBeLessThanOrEqual(0)
  expect(errores, `${ruta} tiene errores en la consola`).toEqual([])
}

for (const [nombre, viewport] of Object.entries(ANCHOS)) {
  test.describe(`Pantallas en ${nombre}`, () => {
    test.use({ viewport })

    for (const [usuario, rutas] of Object.entries(PANTALLAS)) {
      if (rutas.length === 0) continue
      test(`${usuario}`, async ({ page }) => {
        if (usuario !== "anonimo") await iniciarSesion(page, usuario as Usuario)
        for (const ruta of rutas) await revisar(page, ruta)
        // El detalle de una solicitud cualquiera de la lista.
        if (usuario === "ana" || usuario === "laura" || usuario === "admin") {
          await page.goto(usuario === "ana" ? "/mis-solicitudes" : "/gestion")
          const enlace = page.locator('a[href*="solicitudes/"]:not([href$="/nueva"])').first()
          const href = await enlace.getAttribute("href")
          if (href) await revisar(page, href)
        }
      })
    }
  })
}
