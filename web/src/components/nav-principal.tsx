"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { m } from "motion/react"
import { cn } from "@/lib/utils"

type Enlace = { href: string; etiqueta: string }

export function NavPrincipal({ enlaces }: { enlaces: Enlace[] }) {
  const ruta = usePathname()
  // Activo: el enlace más específico que contiene la ruta actual.
  const activo = enlaces
    .filter(({ href }) => ruta === href || ruta.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <nav className="isolate flex items-center gap-1 text-sm">
      {enlaces.map(({ href, etiqueta }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === activo ? "page" : undefined}
          className={cn(
            "relative rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            href === activo ? "font-medium text-foreground" : "hover:bg-muted/60"
          )}
        >
          {href === activo && (
            // La píldora se desliza de un enlace a otro: mismo layoutId en ambos renders.
            <m.span
              layoutId="nav-activo"
              className="absolute inset-0 -z-10 rounded-md bg-muted"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          {etiqueta}
          <IndicadorPendiente />
        </Link>
      ))}
    </nav>
  )
}

// Siempre presente (no mueve el layout); solo cambia la opacidad. El retraso evita parpadeos
// cuando la navegación es instantánea.
function IndicadorPendiente() {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-foreground/40 opacity-0 transition-opacity",
        pending && "animate-pulse opacity-100 delay-150"
      )}
    />
  )
}
