import type { Metadata } from "next"
import Link from "next/link"
import { Suspense, ViewTransition } from "react"
import { ClockIcon, InboxIcon, ScanSearchIcon, XIcon } from "lucide-react"
import { EstadoBadge } from "@/components/estado-badge"
import { RevisionBadge } from "@/components/revision-badge"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DIAS_RECORDATORIO,
  ESTADOS,
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO,
  esEstado,
  esOrigen,
  esTipo,
  estaAbierta,
  type Estado,
} from "@/lib/dominio"
import { diasDesde, formatearFecha, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { FiltrosBandeja } from "./filtros-bandeja"
import { PestanasEstado, type Pestana } from "./pestanas-estado"

export const metadata: Metadata = { title: "Bandeja de solicitudes" }

const POR_PAGINA = 20
const LARGO_EXTRACTO = 140

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

// Lo mínimo que se necesita de una consulta de PostgREST para filtrarla.
type Filtrable<T> = {
  eq(columna: "estado" | "tipo" | "origen" | "revision", valor: string): T
  or(filtros: string): T
}

// Mismos filtros para la tabla y para los conteos. `omitir` deja fuera el filtro que el conteo
// desglosa: las pestañas cuentan por estado respetando la búsqueda, el tipo, el origen y la revisión.
function aplicarFiltros<T extends Filtrable<T>>(consulta: T, filtros: Filtros, omitir?: "estado" | "revision"): T {
  let c = consulta
  if (filtros.estado && omitir !== "estado") c = c.eq("estado", filtros.estado)
  if (filtros.tipo) c = c.eq("tipo", filtros.tipo)
  if (filtros.origen) c = c.eq("origen", filtros.origen)
  if (filtros.porRevisar && omitir !== "revision") c = c.eq("revision", "por_revisar")
  if (filtros.q) c = c.or(`asunto.ilike.%${filtros.q}%,descripcion.ilike.%${filtros.q}%`)
  return c
}

export default async function BandejaPage({ searchParams }: PageProps<"/admin">) {
  const filtros = leerFiltros(await searchParams)
  const supabase = await createClient()

  const conteo = () => supabase.from("solicitudes").select("id", { count: "exact", head: true })
  const [porEstado, revision] = await Promise.all([
    Promise.all(ESTADOS.map((estado) => aplicarFiltros(conteo(), filtros, "estado").eq("estado", estado))),
    aplicarFiltros(conteo(), filtros, "revision").eq("revision", "por_revisar"),
  ])
  const fallo = [...porEstado, revision].find((r) => r.error)?.error
  if (fallo) throw fallo

  const conteos = Object.fromEntries(ESTADOS.map((e, i) => [e, porEstado[i].count ?? 0])) as Record<Estado, number>
  const todas = ESTADOS.reduce((suma, e) => suma + conteos[e], 0)
  const total = filtros.estado ? conteos[filtros.estado] : todas
  const porRevisar = revision.count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const hayFiltros = Boolean(filtros.estado || filtros.tipo || filtros.origen || filtros.porRevisar || filtros.q)

  const pestanas: Pestana[] = [
    { clave: "todas", etiqueta: "Todas", conteo: todas, href: enlaceConFiltros(filtros, { estado: undefined, pagina: 1 }) },
    ...ESTADOS.map((estado) => ({
      clave: estado,
      etiqueta: ETIQUETA_ESTADO[estado],
      conteo: conteos[estado],
      href: enlaceConFiltros(filtros, { estado, pagina: 1 }),
    })),
  ]

  return (
    <TransicionPagina>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bandeja de solicitudes</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "solicitud" : "solicitudes"}
            {hayFiltros && " con los filtros aplicados"}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
            <PestanasEstado pestanas={pestanas} activa={filtros.estado ?? "todas"} />
            {(porRevisar > 0 || filtros.porRevisar) && (
              <Link
                href={enlaceConFiltros(filtros, { porRevisar: !filtros.porRevisar, pagina: 1 })}
                scroll={false}
                className={cn(
                  "mb-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  filtros.porRevisar
                    ? "border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200"
                    : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
                )}
              >
                <ScanSearchIcon className="size-3.5" aria-hidden />
                Por revisar
                <span className="tabular-nums">{porRevisar}</span>
                {filtros.porRevisar && (
                  <>
                    <XIcon className="size-3.5" aria-hidden />
                    <span className="sr-only">(quitar filtro)</span>
                  </>
                )}
              </Link>
            )}
          </div>
          <FiltrosBandeja
            q={filtros.q}
            tipo={filtros.tipo}
            origen={filtros.origen}
            estado={filtros.estado}
            porRevisar={filtros.porRevisar}
            hayFiltros={hayFiltros}
          />
        </div>

        {/* key: cada combinación de filtros es un límite nuevo, así se ve el skeleton mientras llega la tabla. */}
        <Suspense
          key={enlaceConFiltros(filtros, {})}
          fallback={
            <ViewTransition exit="slide-down" default="none">
              <TablaSkeleton />
            </ViewTransition>
          }
        >
          <ViewTransition enter="slide-up" default="none">
            <TablaSolicitudes filtros={filtros} hayFiltros={hayFiltros} />
          </ViewTransition>
        </Suspense>

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
    </TransicionPagina>
  )
}

async function TablaSolicitudes({ filtros, hayFiltros }: { filtros: Filtros; hayFiltros: boolean }) {
  const supabase = await createClient()
  const desde = (filtros.pagina - 1) * POR_PAGINA
  const { data: solicitudes, error } = await aplicarFiltros(
    supabase
      .from("solicitudes")
      .select(
        "id, asunto, descripcion, tipo, estado, origen, revision, motivo_revision, creada, actualizada, estudiante:perfiles!solicitudes_estudiante_id_fkey(nombre)"
      ),
    filtros
  )
    .order("creada", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1)
  if (error) throw error

  if (solicitudes.length === 0) {
    return (
      <Card>
        <CardContent className="grid justify-items-center gap-3 py-12 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
            <InboxIcon className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">
            {hayFiltros ? "Ninguna solicitud coincide con los filtros." : "Todavía no hay solicitudes."}
          </p>
          {hayFiltros && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin" scroll={false}>
                Limpiar filtros
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const ahora = new Date()

  return (
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
          {solicitudes.map((s, i) => (
            <TableRow
              key={s.id}
              className="relative animate-in duration-300 fill-mode-both fade-in slide-in-from-bottom-1"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <TableCell className="pl-4">
                {/* Enlace estirado: el ::after cubre toda la fila, pero sigue siendo un <a> real. */}
                <Link
                  href={`/admin/solicitudes/${s.id}`}
                  transitionTypes={["nav-forward"]}
                  className="block max-w-md truncate font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                >
                  {s.asunto}
                </Link>
                <p className="max-w-md truncate text-xs text-muted-foreground">{extracto(s.descripcion)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{s.estudiante?.nombre}</span>
                  {s.origen === "correo" && <Badge variant="secondary">Correo</Badge>}
                  {s.revision === "por_revisar" && (
                    // Por encima del enlace estirado para que el motivo se vea al pasar el cursor.
                    <RevisionBadge motivo={s.motivo_revision} className="relative z-10" />
                  )}
                </div>
              </TableCell>
              <TableCell>{ETIQUETA_TIPO[s.tipo]}</TableCell>
              <TableCell>
                <EstadoBadge estado={s.estado} />
              </TableCell>
              <TableCell>
                <time dateTime={s.creada}>{formatearFecha(s.creada)}</time>
              </TableCell>
              <TableCell className="pr-4">
                <UltimoCambio estado={s.estado} actualizada={s.actualizada} ahora={ahora} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

function extracto(descripcion: string): string {
  const plano = descripcion.replace(/\s+/g, " ").trim()
  return plano.length > LARGO_EXTRACTO ? `${plano.slice(0, LARGO_EXTRACTO).trimEnd()}…` : plano
}

// Casos abiertos sin movimiento: ámbar desde el umbral del recordatorio, rosa desde el doble.
function UltimoCambio({ estado, actualizada, ahora }: { estado: Estado; actualizada: string; ahora: Date }) {
  const dias = diasDesde(actualizada, ahora)
  const nivel =
    !estaAbierta(estado) || dias < DIAS_RECORDATORIO ? null : dias >= DIAS_RECORDATORIO * 2 ? "critico" : "alerta"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        nivel === null && "text-muted-foreground",
        nivel === "alerta" && "font-medium text-amber-700",
        nivel === "critico" && "font-medium text-rose-700"
      )}
    >
      {nivel && <ClockIcon className="size-3.5" aria-hidden />}
      <time dateTime={actualizada}>{tiempoRelativo(actualizada, ahora)}</time>
      {nivel && <span className="sr-only">, sin movimiento</span>}
    </span>
  )
}

function TablaSkeleton() {
  return (
    <Card className="gap-0 py-0" aria-busy aria-label="Cargando solicitudes">
      <div className="flex h-10 items-center gap-6 border-b px-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-12" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </Card>
  )
}
