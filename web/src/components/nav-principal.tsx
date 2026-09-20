"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

type Enlace = { href: string; etiqueta: string }

export function NavPrincipal({ enlaces }: { enlaces: Enlace[] }) {
  const ruta = usePathname()
  // Activo: el enlace más específico que contiene la ruta actual.
  const activo = enlaces
    .filter(({ href }) => ruta === href || ruta.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href

  return (
    <nav className="flex items-center gap-1 text-sm">
      {enlaces.map(({ href, etiqueta }) => (
        <Link
          key={href}
          href={href}
          aria-current={href === activo ? "page" : undefined}
          className={cn(
            "rounded-md px-2.5 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            href === activo && "bg-muted font-medium text-foreground"
          )}
        >
          {etiqueta}
        </Link>
      ))}
    </nav>
  )
}
