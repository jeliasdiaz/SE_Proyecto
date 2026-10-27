import { expect, test } from "@playwright/test"
import { borrar, consultar, ejecutarFlujo, n8nCorriendo } from "./n8n-local"
import { correosPara, esperarCorreo } from "./utilidades"

// F3: recordatorio de solicitudes abiertas sin cambios hace 3 días o más. Los datos de seed.sql
// traen casos estancados; el flujo se ejecuta como con el botón "Ejecutar ahora".
const F3 = "seF3Recordator01"
const DIAS = 3

type Estancada = { id: string; responsable_id: string | null }
type Persona = { id: string; correo: string; rol: string }

test("F3: un resumen por persona y sin repetir recordatorios", async () => {
  test.skip(!(await n8nCorriendo()), "n8n local no está corriendo (ver n8n/local/README.md).")

  // Punto de partida conocido: sin recordatorios previos.
  await borrar("avisos_enviados?tipo_aviso=eq.recordatorio")
  const limite = new Date(Date.now() - DIAS * 86_400_000).toISOString()
  const estancadas = await consultar<Estancada>(
    `solicitudes?estado=in.(pendiente,en_proceso)&actualizada=lt.${limite}&select=id,responsable_id`
  )
  test.skip(estancadas.length === 0, "No hay casos estancados (corre `supabase db reset`).")
  const personal = await consultar<Persona>("perfiles?rol=in.(asesor,admin)&select=id,correo,rol")
  const admins = personal.filter((p) => p.rol === "admin")

  // Lo esperado: cada responsable sus casos; los que no tienen responsable, a cada admin.
  const esperado = new Map<string, number>()
  for (const caso of estancadas) {
    const responsable = personal.find((p) => p.id === caso.responsable_id)
    for (const persona of responsable ? [responsable] : admins) {
      esperado.set(persona.correo, (esperado.get(persona.correo) ?? 0) + 1)
    }
  }

  const desde = new Date(Date.now() - 1000)
  ejecutarFlujo(F3)
  for (const [correo, cantidad] of esperado) {
    const html = await esperarCorreo(correo, /^Recordatorio: /, desde)
    expect(html.match(/<li>/g), `casos en el resumen de ${correo}`).toHaveLength(cantidad)
    expect(html).toContain("/gestion/solicitudes/")
  }
  // Una fila por solicitud y persona avisada.
  const filas = await consultar<{ solicitud_id: string }>("avisos_enviados?tipo_aviso=eq.recordatorio&select=solicitud_id")
  expect(filas).toHaveLength([...esperado.values()].reduce((a, b) => a + b, 0))

  // Otra ejecución el mismo día no vuelve a avisar.
  const segunda = new Date()
  ejecutarFlujo(F3)
  for (const correo of esperado.keys()) {
    expect((await correosPara(correo, segunda)).filter((m) => m.Subject.startsWith("Recordatorio:"))).toHaveLength(0)
  }
  expect(await consultar("avisos_enviados?tipo_aviso=eq.recordatorio&select=id")).toHaveLength(filas.length)
})
