"use client"

import { useEffect, useRef } from "react"
import { animate, m, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

const ENTRADA = { duration: 0.7, ease: [0.22, 1, 0.36, 1] } as const

// Cuenta desde 0 hasta el valor al montarse. El número real va aparte para lectores de pantalla,
// que así no oyen la cuenta.
export function ContadorAnimado({ valor, className }: { valor: number; className?: string }) {
  const nodo = useRef<HTMLSpanElement>(null)
  const reducido = useReducedMotion()

  useEffect(() => {
    const el = nodo.current
    if (!el) return
    if (reducido) {
      el.textContent = valor.toLocaleString("es-CO")
      return
    }
    const control = animate(0, valor, {
      ...ENTRADA,
      onUpdate: (v) => (el.textContent = Math.round(v).toLocaleString("es-CO")),
    })
    return () => control.stop()
  }, [valor, reducido])

  return (
    <span className={className}>
      <span ref={nodo} aria-hidden>
        0
      </span>
      <span className="sr-only">{valor.toLocaleString("es-CO")}</span>
    </span>
  )
}

export type Segmento = { clave: string; etiqueta: string; valor: number; color: string }

// Parte del todo: una barra apilada con 2 px de superficie entre segmentos. La identidad la dan
// las tarjetas de arriba (punto de color + etiqueta), nunca el color solo.
export function BarraDistribucion({ segmentos }: { segmentos: Segmento[] }) {
  const total = segmentos.reduce((suma, s) => suma + s.valor, 0)
  if (total === 0) return null

  return (
    <div className="flex h-3 gap-0.5" role="img" aria-label={resumen(segmentos, total)}>
      {segmentos
        .filter((s) => s.valor > 0)
        .map((s, i, visibles) => (
          <m.div
            key={s.clave}
            title={`${s.etiqueta}: ${s.valor} (${porcentaje(s.valor, total)})`}
            className={cn(
              "h-full min-w-1 transition-opacity hover:opacity-80",
              i === 0 && "rounded-l-[4px]",
              i === visibles.length - 1 && "rounded-r-[4px]"
            )}
            style={{ backgroundColor: s.color }}
            initial={{ width: 0 }}
            animate={{ width: `${(s.valor / total) * 100}%` }}
            transition={{ ...ENTRADA, delay: 0.1 + i * 0.05 }}
          />
        ))}
    </div>
  )
}

export type Fila = { clave: string; etiqueta: string; valor: number | null; texto: string; detalle: string }

// Una sola serie, un solo tono: la magnitud la da la longitud. Valor al final de la barra;
// el tooltip (hover y foco) solo amplía lo que ya está a la vista.
export function BarrasHorizontales({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  const maximo = Math.max(0, ...filas.map((f) => f.valor ?? 0))

  return (
    <figure className="grid gap-3">
      <figcaption className="text-sm font-medium">{titulo}</figcaption>
      <ul className="grid gap-2">
        {filas.map((fila, i) => {
          // 80 % del ancho como máximo: deja sitio a la etiqueta de valor en la punta.
          const ancho = fila.valor && maximo ? (fila.valor / maximo) * 80 : 0
          return (
            <li
              key={fila.clave}
              tabIndex={0}
              aria-label={`${fila.etiqueta}: ${fila.texto}. ${fila.detalle}`}
              className="group relative grid grid-cols-[minmax(0,7rem)_1fr] items-center gap-3 rounded-md py-0.5 sm:grid-cols-[minmax(0,9rem)_1fr] sm:py-0 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="truncate text-xs text-muted-foreground" title={fila.etiqueta}>
                {fila.etiqueta}
              </span>
              <span className="flex h-6 items-center gap-2">
                {fila.valor !== null && (
                  <m.span
                    className="h-5 min-w-0.5 rounded-r-[4px] bg-(--grafico-serie) transition-opacity group-hover:opacity-80 group-focus-visible:opacity-80"
                    initial={{ width: 0 }}
                    animate={{ width: `${ancho}%` }}
                    transition={{ ...ENTRADA, delay: i * 0.04 }}
                  />
                )}
                <span className="text-xs font-medium whitespace-nowrap tabular-nums">{fila.texto}</span>
              </span>
              <span
                role="presentation"
                className="pointer-events-none absolute bottom-full left-[calc(7rem+0.75rem)] sm:left-[calc(9rem+0.75rem)] z-10 mb-1 hidden rounded-md bg-popover px-2.5 py-1.5 text-xs shadow-md ring-1 ring-foreground/10 group-hover:block group-focus:block"
              >
                <span className="block font-semibold text-foreground">{fila.texto}</span>
                <span className="block text-muted-foreground">
                  {fila.etiqueta} · {fila.detalle}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}

function porcentaje(valor: number, total: number): string {
  return `${Math.round((valor / total) * 100)} %`
}

function resumen(segmentos: Segmento[], total: number): string {
  return `Distribución por estado: ${segmentos.map((s) => `${s.etiqueta} ${porcentaje(s.valor, total)}`).join(", ")}`
}
