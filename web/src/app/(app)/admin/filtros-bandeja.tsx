"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useTransition } from "react"
import { SearchIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Spinner } from "@/components/ui/spinner"
import { ETIQUETA_ORIGEN, ETIQUETA_TIPO, ORIGENES, TIPOS, type Estado, type Origen, type Tipo } from "@/lib/dominio"

// Cada filtro es una navegación y la página se vuelve a montar (los searchParams forman parte de su
// clave), así que el foco se perdería. Esta variable de módulo sobrevive al remontaje y devuelve el
// foco al control que se acaba de usar.
let campoConFoco: string | null = null

type Props = {
  q: string
  tipo?: Tipo
  origen?: Origen
  estado?: Estado
  porRevisar: boolean
  hayFiltros: boolean
}

export function FiltrosBandeja({ q, tipo, origen, estado, porRevisar, hayFiltros }: Props) {
  const router = useRouter()
  const [pendiente, iniciar] = useTransition()
  const formulario = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (!campoConFoco) return
    const campo = formulario.current?.querySelector<HTMLElement>(`[name="${campoConFoco}"]`)
    campoConFoco = null
    // En pantallas táctiles, enfocar el buscador volvería a abrir el teclado.
    if (campo instanceof HTMLInputElement && window.matchMedia("(pointer: coarse)").matches) return
    campo?.focus()
  }, [])

  // Sin JS el formulario hace un GET normal a /admin; con JS se navega sin recargar y solo con los
  // parámetros que tienen valor.
  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault()
    const parametros = new URLSearchParams()
    for (const [clave, valor] of new FormData(evento.currentTarget)) {
      if (typeof valor === "string" && valor.trim()) parametros.set(clave, valor.trim())
    }
    campoConFoco = document.activeElement?.getAttribute("name") ?? "q"
    const cadena = parametros.toString()
    iniciar(() => router.push(cadena ? `/admin?${cadena}` : "/admin", { scroll: false }))
  }

  const aplicar = (evento: React.ChangeEvent<HTMLSelectElement>) => evento.currentTarget.form?.requestSubmit()

  return (
    <form
      ref={formulario}
      action="/admin"
      onSubmit={enviar}
      role="search"
      aria-busy={pendiente}
      className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center"
    >
      {estado && <input type="hidden" name="estado" value={estado} />}
      {porRevisar && <input type="hidden" name="revision" value="por_revisar" />}
      <div className="relative col-span-2 sm:min-w-56 sm:flex-1">
        <button
          type="submit"
          aria-label="Buscar"
          className="absolute inset-y-0 left-0 grid w-10 place-items-center md:w-8 rounded-l-lg text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground"
        >
          <SearchIcon className="size-4" />
        </button>
        <Input
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Buscar en asunto o descripción"
          aria-label="Buscar en asunto o descripción"
          className="pr-8 pl-10 md:pl-8"
        />
        {pendiente && <Spinner className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground" />}
      </div>
      <NativeSelect
        name="tipo"
        aria-label="Tipo"
        defaultValue={tipo ?? ""}
        onChange={aplicar}
        className="w-full sm:w-fit sm:min-w-44"
      >
        <NativeSelectOption value="">Todos los tipos</NativeSelectOption>
        {TIPOS.map((t) => (
          <NativeSelectOption key={t} value={t}>
            {ETIQUETA_TIPO[t]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      <NativeSelect
        name="origen"
        aria-label="Origen"
        defaultValue={origen ?? ""}
        onChange={aplicar}
        className="w-full sm:w-fit sm:min-w-40"
      >
        <NativeSelectOption value="">Cualquier origen</NativeSelectOption>
        {ORIGENES.map((o) => (
          <NativeSelectOption key={o} value={o}>
            {ETIQUETA_ORIGEN[o]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {hayFiltros && (
        <Button asChild variant="ghost" className="col-span-2 sm:col-auto">
          <Link href="/admin" scroll={false}>
            Limpiar
          </Link>
        </Button>
      )}
    </form>
  )
}
