const ZONA_HORARIA = "America/Bogota"

const formatoFecha = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeZone: ZONA_HORARIA,
})

const formatoFechaHora = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZONA_HORARIA,
})

const formatoRelativo = new Intl.RelativeTimeFormat("es-CO", { numeric: "auto" })

export function formatearFecha(iso: string): string {
  return formatoFecha.format(new Date(iso))
}

export function formatearFechaHora(iso: string): string {
  return formatoFechaHora.format(new Date(iso))
}

export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const minutos = Math.round((new Date(iso).getTime() - ahora.getTime()) / 60000)
  if (Math.abs(minutos) < 60) return formatoRelativo.format(minutos, "minute")
  const horas = Math.round(minutos / 60)
  if (Math.abs(horas) < 24) return formatoRelativo.format(horas, "hour")
  return formatoRelativo.format(Math.round(horas / 24), "day")
}

// Días completos transcurridos; mismo cálculo que dias_sin_cambio en la vista solicitudes_estancadas.
export function diasDesde(iso: string, ahora: Date = new Date()): number {
  return Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86_400_000)
}

// Duraciones de las métricas: horas si es menos de dos días, días con un decimal si no.
export function formatearDuracion(horas: number | null): string {
  if (horas === null) return "—"
  if (horas < 48) return `${Math.round(horas)} h`
  return `${(horas / 24).toLocaleString("es-CO", { maximumFractionDigits: 1 })} días`
}
