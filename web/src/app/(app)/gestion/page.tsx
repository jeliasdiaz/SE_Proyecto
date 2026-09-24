import type { Metadata } from "next"
import Link from "next/link"
import { Suspense, ViewTransition } from "react"
import { ClockIcon, InboxIcon, ScanSearchIcon, UserCheckIcon, UserIcon, UserRoundXIcon, XIcon } from "lucide-react"
import { BotonActualizar } from "@/components/boton-actualizar"
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
  ROLES_PERSONAL,
  esEstado,
  esOrigen,
  esTipo,
  estaAbierta,
  type Estado,
} from "@/lib/dominio"
import { requerirPerfil } from "@/lib/auth"
import { diasDesde, formatearFecha, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { BotonTomar } from "./boton-tomar"
import { FiltrosBandeja } from "./filtros-bandeja"
import { PestanasEstado, type Pestana } from "./pestanas-estado"

export const metadata: Metadata = { title: "Bandeja de solicitudes" }

const POR_PAGINA = 20
const LARGO_EXTRACTO = 140
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Una solicitud libre para tomar: sin responsable y todavía abierta.
const ESTADOS_ABIERTOS = ["pendiente", "en_proceso"] as const satisfies readonly Estado[]

type Parametros = Awaited<PageProps<"/gestion">["searchParams"]>

function texto(valor: Parametros[string]): string {
  return typeof valor === "string" ? valor : ""
}

function leerFiltros(parametros: Parametros) {
  const estado = texto(parametros.estado)
  const tipo = texto(parametros.tipo)
  const origen = texto(parametros.origen)
  const responsable = texto(parametros.responsable)
  const pagina = Number.parseInt(texto(parametros.pagina), 10)
  return {
    estado: esEstado(estado) ? estado : undefined,
    tipo: esTipo(tipo) ? tipo : undefined,
    origen: esOrigen(origen) ? origen : undefined,
    porRevisar: texto(parametros.revision) === "por_revisar",
    // "mias", "libres" o el id de una persona (el admin llega así desde el panel de asesores).
    responsable:
      responsable === "mias" || responsable === "libres" || UUID.test(responsable) ? responsable : undefined,
    // Sin caracteres con significado en la sintaxis de filtros de PostgREST.
    q: texto(parametros.q)
      .replace(/[,()"'\\%*]/g, " ")
      .trim()
      .slice(0, 80),
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
  if (f.responsable) parametros.set("responsable", f.responsable)
  if (f.q) parametros.set("q", f.q)
  if (f.pagina > 1) parametros.set("pagina", String(f.pagina))
  const cadena = parametros.toString()
  return cadena ? `/gestion?${cadena}` : "/gestion"
}

// Lo mínimo que se necesita de una consulta de PostgREST para filtrarla.
type Filtrable<T> = {
  eq(columna: "estado" | "tipo" | "origen" | "revision" | "responsable_id", valor: string): T
  is(columna: "responsable_id", valor: null): T
  in(columna: "estado", valores: readonly Estado[]): T
  or(filtros: string): T
}

type Omitible = "estado" | "revision" | "responsable"

// Aplica el filtro de responsable; `yo` resuelve "mias".
function filtrarResponsable<T extends Filtrable<T>>(consulta: T, responsable: string, yo: string): T {
  if (responsable === "libres") return consulta.is("responsable_id", null).in("estado", ESTADOS_ABIERTOS)
  return consulta.eq("responsable_id", responsable === "mias" ? yo : responsable)
}

// Mismos filtros para la tabla y para los conteos. `omitir` deja fuera el filtro que el conteo
// desglosa: las pestañas cuentan por estado respetando la búsqueda, el tipo, el origen, la revisión
// y el responsable.
function aplicarFiltros<T extends Filtrable<T>>(consulta: T, filtros: Filtros, yo: string, omitir?: Omitible): T {
  let c = consulta
  if (filtros.estado && omitir !== "estado") c = c.eq("estado", filtros.estado)
  if (filtros.responsable && omitir !== "responsable") c = filtrarResponsable(c, filtros.responsable, yo)
  if (filtros.tipo) c = c.eq("tipo", filtros.tipo)
  if (filtros.origen) c = c.eq("origen", filtros.origen)
  if (filtros.porRevisar && omitir !== "revision") c = c.eq("revision", "por_revisar")
  if (filtros.q) c = c.or(`asunto.ilike.%${filtros.q}%,descripcion.ilike.%${filtros.q}%`)
  return c
}

export default async function BandejaPage({ searchParams }: PageProps<"/gestion">) {
  const filtros = leerFiltros(await searchParams)
  const perfil = await requerirPerfil(ROLES_PERSONAL)
  const yo = perfil.id
  const supabase = await createClient()

  const conteo = () => supabase.from("solicitudes").select("id", { count: "exact", head: true })
  const otraPersona = filtros.responsable && UUID.test(filtros.responsable) ? filtros.responsable : undefined
  const [porEstado, revision, mias, libres, persona] = await Promise.all([
    Promise.all(ESTADOS.map((estado) => aplicarFiltros(conteo(), filtros, yo, "estado").eq("estado", estado))),
    aplicarFiltros(conteo(), filtros, yo, "revision").eq("revision", "por_revisar"),
    filtrarResponsable(aplicarFiltros(conteo(), filtros, yo, "responsable"), "mias", yo),
    filtrarResponsable(aplicarFiltros(conteo(), filtros, yo, "responsable"), "libres", yo),
    otraPersona
      ? supabase.from("perfiles").select("nombre").eq("id", otraPersona).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  const fallo = [...porEstado, revision, mias, libres, persona].find((r) => r.error)?.error
  if (fallo) throw fallo

  const conteos = Object.fromEntries(ESTADOS.map((e, i) => [e, porEstado[i].count ?? 0])) as Record<Estado, number>
  const todas = ESTADOS.reduce((suma, e) => suma + conteos[e], 0)
  const total = filtros.estado ? conteos[filtros.estado] : todas
  const porRevisar = revision.count ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const hayFiltros = Boolean(
    filtros.estado || filtros.tipo || filtros.origen || filtros.porRevisar || filtros.responsable || filtros.q
  )
  const alternarResponsable = (valor: string) =>
    enlaceConFiltros(filtros, { responsable: filtros.responsable === valor ? undefined : valor, pagina: 1 })

  const pestanas: Pestana[] = [
    {
      clave: "todas",
      etiqueta: "Todas",
      conteo: todas,
      href: enlaceConFiltros(filtros, { estado: undefined, pagina: 1 }),
    },
    ...ESTADOS.map((estado) => ({
      clave: estado,
      etiqueta: ETIQUETA_ESTADO[estado],
      conteo: conteos[estado],
      href: enlaceConFiltros(filtros, { estado, pagina: 1 }),
    })),
  ]

  return (
    <TransicionPagina>
      <div className="grid min-w-0 gap-5">
        <div className="flex items-start justify-between gap-4 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Bandeja de solicitudes</h1>
            <p className="text-sm text-muted-foreground">
              {total} {total === 1 ? "solicitud" : "solicitudes"}
              {hayFiltros && " con los filtros aplicados"}
            </p>
          </div>
          <BotonActualizar className="shrink-0" />
        </div>

        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b">
            <PestanasEstado pestanas={pestanas} activa={filtros.estado ?? "todas"} />
            {/* En móvil van arriba: si quedaran en una segunda línea, el subrayado de las pestañas no
                coincidiría con el borde inferior. */}
            <div className="order-first flex flex-wrap gap-1.5 sm:order-none sm:mb-2">
              <Chip
                href={alternarResponsable("mias")}
                activo={filtros.responsable === "mias"}
                icono={<UserCheckIcon className="size-3.5" aria-hidden />}
                etiqueta="Mías"
                conteo={mias.count ?? 0}
              />
              <Chip
                href={alternarResponsable("libres")}
                activo={filtros.responsable === "libres"}
                icono={<UserRoundXIcon className="size-3.5" aria-hidden />}
                etiqueta="Sin asignar"
                conteo={libres.count ?? 0}
              />
              {otraPersona && (
                <Chip
                  href={alternarResponsable(otraPersona)}
                  activo
                  icono={<UserIcon className="size-3.5" aria-hidden />}
                  etiqueta={persona.data?.nombre ?? "Otra persona"}
                />
              )}
              {(porRevisar > 0 || filtros.porRevisar) && (
                <Chip
                  href={enlaceConFiltros(filtros, { porRevisar: !filtros.porRevisar, pagina: 1 })}
                  activo={filtros.porRevisar}
                  icono={<ScanSearchIcon className="size-3.5" aria-hidden />}
                  etiqueta="Por revisar"
                  conteo={porRevisar}
                  tono="violeta"
                />
              )}
            </div>
          </div>
          <FiltrosBandeja
            q={filtros.q}
            tipo={filtros.tipo}
            origen={filtros.origen}
            estado={filtros.estado}
            porRevisar={filtros.porRevisar}
            responsable={filtros.responsable}
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
            <TablaSolicitudes filtros={filtros} yo={yo} hayFiltros={hayFiltros} />
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

async function TablaSolicitudes({ filtros, yo, hayFiltros }: { filtros: Filtros; yo: string; hayFiltros: boolean }) {
  const supabase = await createClient()
  const desde = (filtros.pagina - 1) * POR_PAGINA
  const { data: solicitudes, error } = await aplicarFiltros(
    supabase
      .from("solicitudes")
      .select(
        "id, asunto, descripcion, tipo, estado, origen, revision, motivo_revision, creada, actualizada, estudiante_id, responsable_id, estudiante:perfiles!solicitudes_estudiante_id_fkey(nombre), responsable:perfiles!solicitudes_responsable_id_fkey(nombre)"
      ),
    filtros,
    yo
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
              <Link href="/gestion" scroll={false}>
                Limpiar filtros
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const ahora = new Date()

  // Mobile-first con un solo marcado: en móvil cada fila es una tarjeta (flex) y desde md vuelve a
  // ser tabla. El estado se repite dentro de la primera celda solo en móvil.
  return (
    <Card className="min-w-0 py-0">
      <Table className="block md:table">
        <TableHeader className="hidden md:table-header-group">
          <TableRow>
            <TableHead className="pl-4">Solicitud</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Responsable</TableHead>
            <TableHead>Registrada</TableHead>
            <TableHead className="pr-4">Último cambio</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="block md:table-row-group">
          {solicitudes.map((s, i) => (
            <TableRow
              key={s.id}
              className="relative flex animate-in flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 duration-300 fill-mode-both fade-in slide-in-from-bottom-1 md:table-row md:p-0"
              style={{ animationDelay: `${Math.min(i, 10) * 30}ms` }}
            >
              <TableCell className="block basis-full p-0 whitespace-normal md:table-cell md:p-2 md:pl-4 md:whitespace-nowrap">
                <div className="flex items-start justify-between gap-3">
                  {/* Enlace estirado: el ::after cubre toda la fila, pero sigue siendo un <a> real. */}
                  <Link
                    href={`/gestion/solicitudes/${s.id}`}
                    transitionTypes={["nav-forward"]}
                    className="line-clamp-2 min-w-0 font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset md:block md:max-w-md md:truncate"
                  >
                    {s.asunto}
                  </Link>
                  <EstadoBadge estado={s.estado} className="shrink-0 md:hidden" />
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground md:max-w-md md:truncate">{extracto(s.descripcion)}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{s.estudiante?.nombre}</span>
                  {s.origen === "correo" && <Badge variant="secondary">Correo</Badge>}
                  {s.revision === "por_revisar" && (
                    // Por encima del enlace estirado para que el motivo se vea al pasar el cursor.
                    <RevisionBadge motivo={s.motivo_revision} className="relative z-10" />
                  )}
                </div>
              </TableCell>
              <TableCell className="block min-w-0 p-0 text-xs text-muted-foreground md:table-cell md:p-2 md:text-sm md:text-foreground">
                {ETIQUETA_TIPO[s.tipo]}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <EstadoBadge estado={s.estado} />
              </TableCell>
              {/* En móvil ocupa su propia línea, al final de la tarjeta. */}
              <TableCell className="order-last block basis-full p-0 text-xs md:order-none md:table-cell md:basis-auto md:p-2 md:text-sm">
                <Responsable
                  solicitudId={s.id}
                  nombre={s.responsable_id === yo ? "Tú" : s.responsable?.nombre}
                  puedeTomar={!s.responsable_id && estaAbierta(s.estado) && s.estudiante_id !== yo}
                />
              </TableCell>
              <TableCell className="block min-w-0 p-0 text-xs text-muted-foreground before:mr-2 before:content-['·'] md:table-cell md:p-2 md:text-sm md:text-foreground md:before:content-none">
                <time dateTime={s.creada}>{formatearFecha(s.creada)}</time>
              </TableCell>
              <TableCell className="ml-auto block p-0 text-xs md:table-cell md:p-2 md:pr-4 md:text-sm">
                <UltimoCambio estado={s.estado} actualizada={s.actualizada} ahora={ahora} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  )
}

// Por encima del enlace estirado (z-10) para que el botón reciba el clic y no abra el caso.
function Responsable({ solicitudId, nombre, puedeTomar }: { solicitudId: string; nombre?: string; puedeTomar: boolean }) {
  if (nombre) return <span className="inline-flex items-center gap-1 text-muted-foreground"><UserIcon className="size-3.5" aria-hidden />{nombre}</span>
  if (puedeTomar) return <BotonTomar solicitudId={solicitudId} className="relative z-10" />
  return <span className="text-muted-foreground">Sin asignar</span>
}

type PropsChip = {
  href: string
  activo: boolean
  icono: React.ReactNode
  etiqueta: string
  conteo?: number
  tono?: "neutro" | "violeta"
}

function Chip({ href, activo, icono, etiqueta, conteo, tono = "neutro" }: PropsChip) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={activo ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        tono === "violeta"
          ? activo
            ? "border-violet-300 bg-violet-100 text-violet-900 hover:bg-violet-200"
            : "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100"
          : activo
            ? "border-sky-300 bg-sky-100 text-sky-900 hover:bg-sky-200"
            : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icono}
      {etiqueta}
      {conteo !== undefined && <span className="tabular-nums">{conteo}</span>}
      {activo && (
        <>
          <XIcon className="size-3.5" aria-hidden />
          <span className="sr-only">(quitar filtro)</span>
        </>
      )}
    </Link>
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
      <div className="hidden h-10 items-center gap-6 border-b px-4 md:flex">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="ml-auto h-3 w-12" />
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-6 border-b px-4 py-3 last:border-0">
          <div className="grid flex-1 gap-1.5">
            <Skeleton className="h-4 w-3/5 md:w-2/5" />
            <Skeleton className="h-3 w-4/5 md:w-3/5" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="hidden h-4 w-16 md:block" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="hidden h-4 w-20 md:block" />
          <Skeleton className="hidden h-4 w-20 md:block" />
        </div>
      ))}
    </Card>
  )
}
