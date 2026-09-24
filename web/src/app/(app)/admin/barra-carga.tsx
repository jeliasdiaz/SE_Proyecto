import { cn } from "@/lib/utils"

// Casos abiertos de una persona como barra horizontal, a la misma escala para todo el equipo:
// la sobrecarga se ve sin leer números. Primero lo estancado (lo urgente, anclado al inicio) y
// luego lo que está al día; 2 px de separación entre tramos y solo el extremo final redondeado.
// Colores validados (contraste y daltonismo) con la guía de visualización.
type Props = { abiertas: number; estancadas: number; maximo: number; className?: string }

export function BarraCarga({ abiertas, estancadas, maximo, className }: Props) {
  const alDia = Math.max(0, abiertas - estancadas)
  const ancho = maximo > 0 ? (abiertas / maximo) * 100 : 0

  return (
    <span className={cn("flex h-3 min-w-0 flex-1 items-center", className)} aria-hidden>
      {abiertas === 0 ? (
        <span className="h-px w-full bg-border" />
      ) : (
        <span className="flex h-full gap-0.5" style={{ width: `${ancho}%` }}>
          {estancadas > 0 && (
            <span
              className={cn("h-full min-w-1 bg-(--grafico-rechazada)", alDia === 0 && "rounded-r-[4px]")}
              style={{ flex: `${estancadas} 1 0` }}
            />
          )}
          {alDia > 0 && (
            <span className="h-full min-w-1 rounded-r-[4px] bg-(--grafico-serie)" style={{ flex: `${alDia} 1 0` }} />
          )}
        </span>
      )}
    </span>
  )
}

export function LeyendaCarga() {
  return (
    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[3px] bg-(--grafico-serie)" />
        Abiertos al día
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-2.5 rounded-[3px] bg-(--grafico-rechazada)" />
        Estancados
      </span>
    </p>
  )
}
