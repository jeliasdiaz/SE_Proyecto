import type { Metadata } from "next"
import Form from "next/form"
import Link from "next/link"
import { EstadoBadge } from "@/components/estado-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO,
  ORIGENES,
  TIPOS,
  esEstado,
  esOrigen,
  esTipo,
} from "@/lib/dominio"
import { formatearFecha, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Bandeja de solicitudes" }

const POR_PAGINA = 20

type Parametros = Awaited<PageProps<"/admin">["searchParams"]>

function texto(valor: Parametros[string]): string {
  return typeof valor === "string" ? valor : ""
}

function leerFiltros(parametros: Parametros) {
  const estado = texto(parametros.estado)
  const tipo = texto(parametros.tipo)
  const origen = texto(parametros.origen)
  const pagina = Number.parseInt(texto(parametros.pagina), 10)
  return {
    estado: esEstado(estado) ? estado : undefined,
    tipo: esTipo(tipo) ? tipo : undefined,
    origen: esOrigen(origen) ? origen : undefined,
    porRevisar: texto(parametros.revision) === "por_revisar",
    // Sin caracteres con significado en la sintaxis de filtros de PostgREST.
    q: texto(parametros.q).replace(/[,()"'\\%*]/g, " ").trim().slice(0, 80),
    pagina: Number.isFinite(pagina) && pagina > 0 ? pagina : 1,
  }
}

type Filtros = ReturnType<typeof leerFiltros>

function enlaceConFiltros(filtros: Filtros, cambios: Partial<Filtros>): string {
  const f = { ...filtros, ...cambios }
  const parametros = new URLSearchParams()
  if (f.estado) parametros.set("estado", f.estado)
  if (f.tipo) parametros.set("tipo", f.tipo)
  if (f.origen) parametros.set("origen", f.origen)
  if (f.porRevisar) parametros.set("revision", "por_revisar")
  if (f.q) parametros.set("q", f.q)
  if (f.pagina > 1) parametros.set("pagina", String(f.pagina))
  const cadena = parametros.toString()
  return cadena ? `/admin?${cadena}` : "/admin"
}

export default async function BandejaPage({ searchParams }: PageProps<"/admin">) {
  const filtros = leerFiltros(await searchParams)
  const supabase = await createClient()

  let consulta = supabase
    .from("solicitudes")
    .select(
      "id, asunto, tipo, estado, origen, revision, creada, actualizada, estudiante:perfiles!solicitudes_estudiante_id_fkey(nombre)",
      { count: "exact" }
    )
  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado)
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo)
  if (filtros.origen) consulta = consulta.eq("origen", filtros.origen)
  if (filtros.porRevisar) consulta = consulta.eq("revision", "por_revisar")
  if (filtros.q) consulta = consulta.or(`asunto.ilike.%${filtros.q}%,descripcion.ilike.%${filtros.q}%`)

  const desde = (filtros.pagina - 1) * POR_PAGINA
  const [{ data: solicitudes, count, error }, { count: porRevisar }] = await Promise.all([
    consulta.order("creada", { ascending: false }).range(desde, desde + POR_PAGINA - 1),
    supabase.from("solicitudes").select("id", { count: "exact", head: true }).eq("revision", "por_revisar"),
  ])
  if (error) throw error

  const total = count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const hayFiltros = Boolean(filtros.estado || filtros.tipo || filtros.origen || filtros.porRevisar || filtros.q)

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bandeja de solicitudes</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "solicitud" : "solicitudes"}
            {hayFiltros && " con los filtros aplicados"}
          </p>
        </div>
        {Boolean(porRevisar) && !filtros.porRevisar && (
          <Button asChild variant="outline">
            <Link href={enlaceConFiltros(filtros, { porRevisar: true, pagina: 1 })}>
              Por revisar
              <Badge className="bg-amber-500 text-white">{porRevisar}</Badge>
            </Link>
          </Button>
        )}
      </div>

      <Card size="sm">
        <CardContent>
          {/* key: al cambiar los filtros por un enlace, el formulario se vuelve a montar con los valores nuevos. */}
          <Form key={enlaceConFiltros(filtros, { pagina: 1 })} action="/admin" className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-56 flex-1 gap-1.5">
              <label htmlFor="q" className="text-xs font-medium text-muted-foreground">
                Buscar en asunto o descripción
              </label>
              <Input id="q" name="q" defaultValue={filtros.q} placeholder="Ej.: homologación cálculo" />
            </div>
            <FiltroSelect id="estado" etiqueta="Estado" valor={filtros.estado}>
              {ESTADOS.map((e) => (
                <NativeSelectOption key={e} value={e}>
                  {ETIQUETA_ESTADO[e]}
                </NativeSelectOption>
              ))}
            </FiltroSelect>
            <FiltroSelect id="tipo" etiqueta="Tipo" valor={filtros.tipo}>
              {TIPOS.map((t) => (
                <NativeSelectOption key={t} value={t}>
                  {ETIQUETA_TIPO[t]}
                </NativeSelectOption>
              ))}
            </FiltroSelect>
            <FiltroSelect id="origen" etiqueta="Origen" valor={filtros.origen}>
              {ORIGENES.map((o) => (
                <NativeSelectOption key={o} value={o}>
                  {ETIQUETA_ORIGEN[o]}
                </NativeSelectOption>
              ))}
            </FiltroSelect>
            <FiltroSelect id="revision" etiqueta="Revisión" valor={filtros.porRevisar ? "por_revisar" : undefined}>
              <NativeSelectOption value="por_revisar">Por revisar</NativeSelectOption>
            </FiltroSelect>
            <div className="flex gap-2">
              <Button type="submit">Filtrar</Button>
              {hayFiltros && (
                <Button asChild variant="ghost">
                  <Link href="/admin">Limpiar</Link>
                </Button>
              )}
            </div>
          </Form>
        </CardContent>
      </Card>

      {solicitudes.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {hayFiltros ? "Ninguna solicitud coincide con los filtros." : "Todavía no hay solicitudes."}
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Solicitud</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registrada</TableHead>
                <TableHead className="pr-4">Último cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitudes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-96 pl-4">
                    <Link href={`/admin/solicitudes/${s.id}`} className="block truncate font-medium hover:underline">
                      {s.asunto}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{s.estudiante?.nombre}</span>
                      {s.origen === "correo" && <Badge variant="secondary">Correo</Badge>}
                      {s.revision === "por_revisar" && (
                        <Badge className="border-amber-200 bg-amber-100 text-amber-900">Por revisar</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{ETIQUETA_TIPO[s.tipo]}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={s.estado} />
                  </TableCell>
                  <TableCell>{formatearFecha(s.creada)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">{tiempoRelativo(s.actualizada)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {paginas > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
          <span className="text-muted-foreground">
            Página {filtros.pagina} de {paginas}
          </span>
          <div className="flex gap-2">
            {filtros.pagina > 1 && (
              <Button asChild variant="outline" size="sm">
                <Link href={enlaceConFiltros(filtros, { pagina: filtros.pagina - 1 })}>Anterior</Link>
              </Button>
            )}
            {filtros.pagina < paginas && (
              <Button asChild variant="outline" size="sm">
                <Link href={enlaceConFiltros(filtros, { pagina: filtros.pagina + 1 })}>Siguiente</Link>
              </Button>
            )}
          </div>
        </nav>
      )}
    </div>
  )
}

function FiltroSelect({
  id,
  etiqueta,
  valor,
  children,
}: {
  id: string
  etiqueta: string
  valor?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        {etiqueta}
      </label>
      <NativeSelect id={id} name={id} defaultValue={valor ?? ""} className="min-w-40">
        <NativeSelectOption value="">Todos</NativeSelectOption>
        {children}
      </NativeSelect>
    </div>
  )
}
