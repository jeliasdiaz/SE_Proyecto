import { execSync } from "node:child_process"
import { defineConfig, devices } from "@playwright/test"

// Pruebas de punta a punta contra el Supabase LOCAL con los datos de supabase/seed.sql.
// Antes de correrlas: `npx supabase start --workdir ..` y `npx supabase db reset --workdir ..`
// (desde web/). La app corre en 127.0.0.1:3000 porque es la site_url de supabase/config.toml:
// los enlaces de los correos de autenticación apuntan ahí. Ver docs/plan-qa-demo.md.

// Llaves del Supabase local, leídas de `supabase status` para no escribirlas en el código.
if (!process.env.SUPABASE_SECRET_KEY || !process.env.SUPABASE_PUBLISHABLE_KEY) {
  const estado = execSync("npx supabase status -o env --workdir ..", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  })
  for (const linea of estado.split("\n")) {
    const [clave, ...resto] = linea.split("=")
    const valor = resto.join("=").replace(/^"|"$/g, "")
    if (clave === "SECRET_KEY") process.env.SUPABASE_SECRET_KEY ??= valor
    if (clave === "PUBLISHABLE_KEY") process.env.SUPABASE_PUBLISHABLE_KEY ??= valor
  }
}

export default defineConfig({
  testDir: "./e2e",
  // Comparten la base de datos: en serie para que una prueba no cambie lo que otra está mirando.
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3000",
    locale: "es-CO",
    timezoneId: "America/Bogota",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start -- -H 127.0.0.1 -p 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: true,
    timeout: 180_000,
  },
})
