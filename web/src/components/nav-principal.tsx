"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { m } from "motion/react"
import { ChartColumnIcon, FilePlusIcon, FilesIcon, InboxIcon, UserCogIcon, UsersIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// El layout es server component: pasa el nombre del ícono, no el componente.
const ICONOS = {
  bandeja: InboxIcon,
  metricas: ChartColumnIcon,
  solicitudes: FilesIcon,
  nueva: FilePlusIcon,
  asesores: UsersIcon,
  usuarios: UserCogIcon,
}

export type Enlace = { href: string; etiqueta: string; icono: keyof typeof ICONOS }

function useActivo(enlaces: Enlace[]) {
  const ruta = usePathname()
  // Activo: el enlace más específico que contiene la ruta actual.
  return enlaces
    .filter(({ href }) => ruta === href || ruta.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

// Desde sm: pestañas en el header, con una píldora que se desliza hacia el enlace activo.
export function NavPrincipal({ enlaces }: { enlaces: Enlace[] }) {
  const activo = useActivo(enlaces)

  return (
    <nav aria-label="Principal" className="isolate hidden items-center gap-1 text-sm sm:flex">
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
            <m.span
              layoutId="nav-activo"
              className="absolute inset-0 -z-10 rounded-md bg-muted"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          {etiqueta}
          <IndicadorPendiente className="inset-x-2.5 -bottom-0.5" />
        </Link>
      ))}
    </nav>
  )
}

// Móvil: barra inferior al alcance del pulgar. Respeta la zona segura de iOS (viewport-fit=cover).
export function NavInferior({ enlaces }: { enlaces: Enlace[] }) {
  const activo = useActivo(enlaces)

  return (
    <nav
      aria-label="Principal"
      style={{ viewTransitionName: "nav-inferior" }}
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <div className="isolate mx-auto grid max-w-md" style={{ gridTemplateColumns: `repeat(${enlaces.length}, 1fr)` }}>
        {enlaces.map(({ href, etiqueta, icono }) => {
          const Icono = ICONOS[icono]
          const esActivo = href === activo
          return (
            <Link
              key={href}
              href={href}
              aria-current={esActivo ? "page" : undefined}
              className={cn(
                "relative flex h-16 flex-col items-center justify-center gap-1 text-xs text-muted-foreground outline-none focus-visible:bg-muted",
                esActivo && "font-medium text-foreground"
              )}
            >
              {esActivo && (
                <m.span
                  layoutId="nav-inferior-activo"
                  className="absolute top-2 -z-10 h-8 w-14 rounded-full bg-muted"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icono className="size-5" aria-hidden />
              {etiqueta}
              <IndicadorPendiente className="inset-x-6 top-0" />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

// Siempre presente (no mueve el layout); solo cambia la opacidad. El retraso evita parpadeos
// cuando la navegación es instantánea.
function IndicadorPendiente({ className }: { className?: string }) {
  const { pending } = useLinkStatus()
  return (
    <span
      aria-hidden
      className={cn(
        "absolute h-0.5 rounded-full bg-foreground/40 opacity-0 transition-opacity",
        pending && "animate-pulse opacity-100 delay-150",
        className
      )}
    />
  )
}
