"use client"

import { useRef, useState } from "react"
import { ChevronDownIcon, LogOutIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Spinner } from "@/components/ui/spinner"
import type { Rol } from "@/lib/dominio"
import { cerrarSesion } from "@/app/(auth)/actions"

const ETIQUETA_ROL: Record<Rol, string> = { admin: "Administración", estudiante: "Estudiante" }

function iniciales(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((palabra) => palabra[0]!.toUpperCase())
    .join("")
}

type Props = { nombre: string; correo: string; rol: Rol }

export function MenuUsuario({ nombre, correo, rol }: Props) {
  const formulario = useRef<HTMLFormElement>(null)
  const [cerrando, setCerrando] = useState(false)

  return (
    <>
      {/* Fuera del menú: el contenido del menú se desmonta al cerrarse y cancelaría el envío. */}
      <form ref={formulario} action={cerrarSesion} hidden />
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:bg-muted">
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-full bg-foreground/85 text-[0.7rem] font-semibold text-background"
          >
            {iniciales(nombre)}
          </span>
          <span className="hidden max-w-48 truncate font-medium sm:inline">{nombre}</span>
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="grid gap-1 py-1.5 font-normal">
            <span className="truncate font-medium text-foreground">{nombre}</span>
            <span className="truncate text-xs text-muted-foreground">{correo}</span>
            <Badge variant="secondary" className="mt-1">
              {ETIQUETA_ROL[rol]}
            </Badge>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={cerrando}
            onSelect={(evento) => {
              evento.preventDefault()
              setCerrando(true)
              formulario.current?.requestSubmit()
            }}
          >
            {cerrando ? <Spinner /> : <LogOutIcon />}
            {cerrando ? "Cerrando sesión…" : "Cerrar sesión"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}
