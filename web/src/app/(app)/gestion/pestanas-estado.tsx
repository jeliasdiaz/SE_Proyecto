"use client"

import Link, { useLinkStatus } from "next/link"
import { m } from "motion/react"
import { cn } from "@/lib/utils"

export type Pestana = { clave: string; etiqueta: string; conteo: number; href: string }

export function PestanasEstado({ pestanas, activa }: { pestanas: Pestana[]; activa: string }) {
  return (
    <nav
      aria-label="Estado"
      className="-mb-px flex min-w-0 w-full overflow-x-auto [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden"
    >
      {pestanas.map((pestana) => {
        const esActiva = pestana.clave === activa
        return (
          <Link
            key={pestana.clave}
            href={pestana.href}
            scroll={false}
            aria-current={esActiva ? "true" : undefined}
            className={cn(
              "relative flex items-center gap-1.5 px-3 pt-1 pb-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50",
              esActiva && "font-medium text-foreground"
            )}
          >
            {pestana.etiqueta}
            <span
              className={cn(
                "min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums transition-colors",
                esActiva ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
              )}
            >
              {pestana.conteo}
            </span>
            {esActiva && (
              // La página se vuelve a montar al cambiar de pestaña; layoutId anima el subrayado igual.
              <m.span
                layoutId="pestana-estado"
                className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground"
                transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              />
            )}
            <Pendiente />
          </Link>
        )
      })}
    </nav>
  )
}

function Pendiente() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-foreground/30 opacity-0 transition-opacity",
        pending && "animate-pulse opacity-100 delay-150"
      )}
    />
  )
}
