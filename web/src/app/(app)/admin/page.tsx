import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRightIcon, ClockIcon, ScaleIcon, UserCogIcon, UsersIcon } from "lucide-react"
import { BotonActualizar } from "@/components/boton-actualizar"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { DIAS_RECORDATORIO, ETIQUETA_ROL } from "@/lib/dominio"
import { formatearDuracion, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { BarraCarga, LeyendaCarga } from "./barra-carga"

export const metadata: Metadata = { title: "Carga del equipo" }

// Se avisa cuando alguien tiene al menos 1,5 veces el promedio de casos abiertos del equipo.
// Con menos de 5 casos abiertos en total la diferencia no dice nada.
const FACTOR_DESBALANCE = 1.5
const MINIMO_PARA_AVISAR = 5

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

export default async function CargaEquipoPage() {
  const perfil = await requerirPerfil("admin")
  const supabase = await createClient()
  const [carga, libres, estancadasLibres] = await Promise.all([
    supabase
      .from("carga_por_asesor")
      .select("id, nombre, rol, pendientes, en_proceso, finalizadas, rechazadas, estancadas, horas_resolucion, ultima_actividad"),
    supabase
      .from("solicitudes")
      .select("id", { count: "exact", head: true })
      .is("responsable_id", null)
      .in("estado", ["pendiente", "en_proceso"]),
    supabase
      .from("solicitudes_estancadas")
      .select("id", { count: "exact", head: true })
      .is("responsable_id", null),
  ])
  if (carga.error) throw carga.error
  if (libres.error) throw libres.error
  if (estancadasLibres.error) throw estancadasLibres.error

  const personas = carga.data
    .flatMap((p) =>
      p.id && p.rol
        ? [
            {
              id: p.id,
              nombre: p.nombre ?? "Sin nombre",
              rol: p.rol,
              abiertas: (p.pendientes ?? 0) + (p.en_proceso ?? 0),
              estancadas: p.estancadas ?? 0,
              cerradas: (p.finalizadas ?? 0) + (p.rechazadas ?? 0),
              horasResolucion: p.horas_resolucion,
              ultimaActividad: p.ultima_actividad,
            },
          ]
        : []
    )
    // Primero quien más casos abiertos tiene: es a quien conviene quitarle carga.
    .sort((a, b) => b.abiertas - a.abiertas || b.estancadas - a.estancadas || a.nombre.localeCompare(b.nombre))

  const asesores = personas.filter((p) => p.rol === "asesor").length
  const abiertasAsignadas = personas.reduce((suma, p) => suma + p.abiertas, 0)
  const maximo = Math.max(0, ...personas.map((p) => p.abiertas))
  const sinAsignar = libres.count ?? 0
  const estancadasAsignadas = personas.reduce((suma, p) => suma + p.estancadas, 0)
  const estancadasSinAsignar = estancadasLibres.count ?? 0
  const estancadas = estancadasAsignadas + estancadasSinAsignar

  const promedio = personas.length > 0 ? abiertasAsignadas / personas.length : 0
  const masCargada = personas[0]
  const desbalance =
    personas.length >= 2 &&
    abiertasAsignadas >= MINIMO_PARA_AVISAR &&
    masCargada.abiertas >= promedio * FACTOR_DESBALANCE
      ? masCargada
      : null
  const ahora = new Date()

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Carga del equipo</h1>
            <p className="text-sm text-muted-foreground">Quién atiende qué y quién necesita ayuda.</p>
          </div>
          <BotonActualizar className="shrink-0" />
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Asesores" valor={asesores} />
          <Indicador etiqueta="Abiertos asignados" valor={abiertasAsignadas} />
          <Indicador
            etiqueta="Sin asignar"
            valor={sinAsignar}
            detalle={sinAsignar > 0 ? "Ver en la bandeja" : "Todo tiene responsable"}
            href={sinAsignar > 0 ? "/gestion?responsable=libres" : undefined}
            tono={sinAsignar > 0 ? "alerta" : undefined}
          />
          <Indicador
            etiqueta={`Estancados (${DIAS_RECORDATORIO}+ días)`}
            valor={estancadas}
            detalle={
              estancadas > 0 ? `${estancadasAsignadas} asignados · ${estancadasSinAsignar} sin asignar` : "Nada detenido"
            }
            href={estancadas > 0 ? "/admin/metricas" : undefined}
            tono={estancadas > 0 ? "critico" : undefined}
          />
        </dl>

        {desbalance && (
          <Alert className="border-amber-200 bg-amber-50 text-amber-950">
            <ScaleIcon />
            <AlertTitle>
              {desbalance.id === perfil.id ? "Tú concentras" : `${desbalance.nombre} concentra`} el{" "}
              {Math.round((desbalance.abiertas / abiertasAsignadas) * 100)} % de los casos abiertos
            </AlertTitle>
            <AlertDescription className="text-amber-900/80">
              <p>
                {desbalance.abiertas} de {abiertasAsignadas}; el promedio del equipo es {promedio.toFixed(1).replace(".", ",")}.{" "}
                <Link
                  href={`/gestion?responsable=${desbalance.id}&estado=pendiente`}
                  className="font-medium text-amber-950 underline underline-offset-4"
                >
                  Ver sus pendientes para reasignar
                </Link>
              </p>
            </AlertDescription>
          </Alert>
        )}

        <Card className="gap-0 pb-0">
          <CardHeader className="gap-2 border-b pb-4">
            <CardTitle>Casos abiertos por persona</CardTitle>
            <CardDescription>Abre una fila para ver sus casos en la bandeja.</CardDescription>
            {personas.length > 0 && <LeyendaCarga />}
          </CardHeader>
          <CardContent className="px-0">
            {personas.length === 0 ? (
              <div className="grid justify-items-center gap-3 px-4 py-12 text-center">
                <span className="grid size-10 place-items-center rounded-full bg-muted text-muted-foreground">
                  <UsersIcon className="size-5" />
                </span>
                <p className="text-sm text-muted-foreground">Todavía no hay asesores.</p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/admin/usuarios">
                    <UserCogIcon data-icon="inline-start" />
                    Agregar asesores
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                {personas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/gestion?responsable=${p.id}`}
                      className="group grid gap-x-6 gap-y-2 px-4 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)_1rem] md:items-center"
                    >
                      <span className="grid min-w-0 gap-0.5">
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="truncate font-medium">{p.nombre}</span>
                          {p.id === perfil.id && <Badge variant="outline">Tú</Badge>}
                          {p.rol === "admin" && <Badge variant="secondary">{ETIQUETA_ROL.admin}</Badge>}
                        </span>
                        <Resumen persona={p} ahora={ahora} />
                      </span>
                      <span className="flex min-w-0 items-center gap-2">
                        <BarraCarga abiertas={p.abiertas} estancadas={p.estancadas} maximo={maximo} />
                        <span className="w-6 text-right text-sm font-semibold tabular-nums">{p.abiertas}</span>
                      </span>
                      <ChevronRightIcon className="hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </TransicionPagina>
  )
}

type Persona = {
  abiertas: number
  estancadas: number
  cerradas: number
  horasResolucion: number | null
  ultimaActividad: string | null
}

// Solo lo que aporta: sin ceros ni guiones. Dos líneas fijas (cuánto tiene y a qué ritmo va) para
// que al envolver ningún separador quede suelto al inicio de una línea.
function Resumen({ persona: p, ahora }: { persona: Persona; ahora: Date }) {
  const carga: React.ReactNode[] = [p.abiertas > 0 ? plural(p.abiertas, "abierto", "abiertos") : "Sin casos abiertos"]
  if (p.estancadas > 0) {
    carga.push(
      <span key="estancadas" className="inline-flex items-center gap-1 font-medium text-rose-700">
        <ClockIcon className="size-3" aria-hidden />
        {plural(p.estancadas, "estancado", "estancados")}
      </span>
    )
  }
  if (p.cerradas > 0) carga.push(plural(p.cerradas, "cerrado", "cerrados"))
  const ritmo: React.ReactNode[] = []
  if (p.horasResolucion !== null) ritmo.push(`resuelve en ${formatearDuracion(p.horasResolucion)}`)
  if (p.ultimaActividad) ritmo.push(`activo ${tiempoRelativo(p.ultimaActividad, ahora)}`)

  return (
    <>
      <Linea partes={carga} />
      {ritmo.length > 0 && <Linea partes={ritmo} />}
    </>
  )
}

function Linea({ partes }: { partes: React.ReactNode[] }) {
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
      {partes.map((parte, i) => (
        <span key={i} className="inline-flex items-center gap-1.5">
          {i > 0 && <span aria-hidden>·</span>}
          {parte}
        </span>
      ))}
    </span>
  )
}

type PropsIndicador = {
  etiqueta: string
  valor: number
  detalle?: string
  href?: string
  tono?: "alerta" | "critico"
}

function Indicador({ etiqueta, valor, detalle, href, tono }: PropsIndicador) {
  const contenido = (
    <>
      <dt className="text-sm text-muted-foreground">{etiqueta}</dt>
      <dd
        className={cn(
          "text-2xl font-semibold tracking-tight tabular-nums",
          tono === "alerta" && "text-amber-700",
          tono === "critico" && "text-rose-700"
        )}
      >
        {valor}
      </dd>
      {detalle && <dd className="text-xs text-muted-foreground">{detalle}</dd>}
    </>
  )
  const clases = "grid content-start gap-1 rounded-xl border bg-card p-4"
  if (!href) return <div className={clases}>{contenido}</div>
  return (
    <Link
      href={href}
      className={cn(clases, "transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50")}
    >
      {contenido}
    </Link>
  )
}
