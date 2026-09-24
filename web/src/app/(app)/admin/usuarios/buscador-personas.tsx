"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import { SearchIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ETIQUETA_ROL } from "@/lib/dominio"
import { buscarPersonas, type PersonaEncontrada } from "./actions"
import { BotonRol } from "./boton-rol"

const ESPERA_MS = 300

// Busca mientras se escribe. Con una Server Action y no con la URL: navegar volvería a montar la
// página en cada tecla y el campo perdería el foco.
export function BuscadorPersonas() {
  const [texto, setTexto] = useState("")
  const [resultado, setResultado] = useState<{ q: string; personas: PersonaEncontrada[]; hayMas: boolean } | null>(null)
  const [buscando, iniciar] = useTransition()
  const ultima = useRef("")

  const buscar = (q: string) => {
    ultima.current = q
    iniciar(async () => {
      const r = await buscarPersonas(q)
      // Descarta respuestas de búsquedas anteriores que lleguen tarde.
      if (ultima.current === q) setResultado({ q, ...r })
    })
  }

  useEffect(() => {
    const q = texto.trim()
    if (q.length < 2) {
      ultima.current = ""
      return
    }
    const temporizador = setTimeout(() => buscar(q), ESPERA_MS)
    return () => clearTimeout(temporizador)
  }, [texto])

  const q = texto.trim()
  const visible = q.length >= 2 ? resultado : null

  return (
    <div className="grid gap-3">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Nombre, correo o ID estudiantil"
          aria-label="Buscar por nombre, correo o ID estudiantil"
          className="pr-9 pl-9"
        />
        {buscando && <Spinner className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />}
      </div>
      <div aria-live="polite">
        {visible &&
          (visible.personas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nadie coincide con «{visible.q}».</p>
          ) : (
            <ul className="-mx-2 grid divide-y">
              {visible.personas.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{p.nombre}</span>
                      {p.rol !== "estudiante" && <Badge variant="secondary">{ETIQUETA_ROL[p.rol]}</Badge>}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{p.correo}</p>
                    {p.id_estudiantil && <p className="text-xs text-muted-foreground">ID {p.id_estudiantil}</p>}
                  </div>
                  {p.rol === "estudiante" ? (
                    <BotonRol usuarioId={p.id} nombre={p.nombre} accion="promover" onHecho={() => buscar(visible.q)} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Ya está en el equipo</span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        {visible?.hayMas && (
          <p className="mt-2 text-xs text-muted-foreground">Hay más resultados. Escribe algo más específico.</p>
        )}
      </div>
    </div>
  )
}
