import { EstadoBadge } from "@/components/estado-badge"
import type { Estado } from "@/lib/dominio"
import { formatearFechaHora } from "@/lib/fechas"

export type EventoHistorial = {
  id: number
  estadoAnterior: Estado | null
  estadoNuevo: Estado
  observacion: string | null
  fecha: string
  autor: string
}

export function HistorialTimeline({ eventos }: { eventos: EventoHistorial[] }) {
  if (eventos.length === 0) {
    return <p className="text-sm text-muted-foreground">Sin movimientos registrados.</p>
  }

  return (
    <ol className="relative grid gap-5 border-l pl-5">
      {eventos.map((evento) => (
        <li key={evento.id} className="relative grid gap-1">
          <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-foreground/60" />
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {evento.estadoAnterior === null ? (
              <span className="font-medium">Solicitud registrada</span>
            ) : (
              <>
                <EstadoBadge estado={evento.estadoAnterior} />
                <span aria-label="cambió a" className="text-muted-foreground">
                  →
                </span>
                <EstadoBadge estado={evento.estadoNuevo} />
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {formatearFechaHora(evento.fecha)} · {evento.autor}
          </p>
          {evento.observacion && (
            <p className="rounded-md bg-muted px-3 py-2 text-sm whitespace-pre-wrap">{evento.observacion}</p>
          )}
        </li>
      ))}
    </ol>
  )
}
