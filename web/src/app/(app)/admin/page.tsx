import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRightIcon, ClockIcon, UserCogIcon, UsersIcon } from "lucide-react"
import { BotonActualizar } from "@/components/boton-actualizar"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DIAS_RECORDATORIO, ETIQUETA_ROL } from "@/lib/dominio"
import { formatearDuracion, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"

export const metadata: Metadata = { title: "Asesores" }

export default async function AsesoresPage() {
  const supabase = await createClient()
  const [carga, libres, estancadasLibres] = await Promise.all([
    supabase
      .from("carga_por_asesor")
      .select("id, nombre, correo, rol, pendientes, en_proceso, finalizadas, rechazadas, estancadas, horas_resolucion, ultima_actividad"),
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
              ...p,
              id: p.id,
              rol: p.rol,
              abiertas: (p.pendientes ?? 0) + (p.en_proceso ?? 0),
              cerradas: (p.finalizadas ?? 0) + (p.rechazadas ?? 0),
            },
          ]
        : []
    )
    // Primero quien más casos abiertos tiene: es a quien conviene quitarle carga.
    .sort((a, b) => b.abiertas - a.abiertas || (a.nombre ?? "").localeCompare(b.nombre ?? ""))
  const asesores = personas.filter((p) => p.rol === "asesor").length
  const abiertasAsignadas = personas.reduce((suma, p) => suma + p.abiertas, 0)
  const sinAsignar = libres.count ?? 0
  const estancadas = personas.reduce((suma, p) => suma + (p.estancadas ?? 0), 0) + (estancadasLibres.count ?? 0)
  const ahora = new Date()

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Asesores</h1>
            <p className="text-sm text-muted-foreground">Quién atiende qué y cuánta carga tiene cada persona.</p>
          </div>
          <BotonActualizar className="shrink-0" />
        </div>

        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Indicador etiqueta="Asesores" valor={asesores} />
          <Indicador etiqueta="Casos abiertos asignados" valor={abiertasAsignadas} />
          <Indicador
            etiqueta="Sin asignar"
            valor={sinAsignar}
            href={sinAsignar > 0 ? "/gestion?responsable=libres" : undefined}
            tono={sinAsignar > 0 ? "alerta" : undefined}
          />
          <Indicador
            etiqueta={`Estancados (${DIAS_RECORDATORIO}+ días)`}
            valor={estancadas}
            href={estancadas > 0 ? "/admin/metricas" : undefined}
            tono={estancadas > 0 ? "critico" : undefined}
          />
        </dl>

        <Card className="gap-0 pb-0">
          <CardHeader className="border-b pb-4">
            <CardTitle>Carga por persona</CardTitle>
            <CardDescription>Abre una fila para ver en la bandeja los casos de esa persona.</CardDescription>
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
                    Asignar asesores
                  </Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y">
                <li
                  aria-hidden
                  className="hidden grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_1rem] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground md:grid"
                >
                  <span>Persona</span>
                  <span className="text-right">Abiertas</span>
                  <span className="text-right">Estancadas</span>
                  <span className="text-right">Cerradas</span>
                  <span className="text-right">Resolución</span>
                </li>
                {personas.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/gestion?responsable=${p.id}`}
                      className="group grid grid-cols-3 gap-x-4 gap-y-2 px-4 py-3 transition-colors outline-none hover:bg-muted/60 focus-visible:bg-muted/60 md:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_1rem] md:items-center"
                    >
                      <span className="col-span-3 min-w-0 md:col-span-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate font-medium">{p.nombre}</span>
                          {p.rol === "admin" && <Badge variant="secondary">{ETIQUETA_ROL.admin}</Badge>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {p.correo}
                          {p.ultima_actividad && ` · último movimiento ${tiempoRelativo(p.ultima_actividad, ahora)}`}
                        </span>
                      </span>
                      <Dato etiqueta="Abiertas" valor={String(p.abiertas)} detalle={`${p.pendientes ?? 0} pend. · ${p.en_proceso ?? 0} en proc.`} />
                      <Dato
                        etiqueta="Estancadas"
                        valor={String(p.estancadas ?? 0)}
                        className={cn(
                          (p.estancadas ?? 0) > 0 && "text-amber-700",
                          (p.estancadas ?? 0) >= 3 && "text-rose-700"
                        )}
                        icono={(p.estancadas ?? 0) > 0}
                      />
                      <Dato etiqueta="Cerradas" valor={String(p.cerradas)} />
                      <Dato
                        etiqueta="Resolución"
                        valor={formatearDuracion(p.horas_resolucion)}
                        className="col-span-3 md:col-span-1"
                      />
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

type PropsIndicador = { etiqueta: string; valor: number; href?: string; tono?: "alerta" | "critico" }

function Indicador({ etiqueta, valor, href, tono }: PropsIndicador) {
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

type PropsDato = { etiqueta: string; valor: string; detalle?: string; className?: string; icono?: boolean }

// En móvil lleva su etiqueta; desde md la etiqueta está en el encabezado de la lista.
function Dato({ etiqueta, valor, detalle, className, icono }: PropsDato) {
  return (
    <span className={cn("grid content-start md:text-right", className)}>
      <span className="text-xs text-muted-foreground md:sr-only">{etiqueta}</span>
      <span className="inline-flex items-center gap-1 font-medium tabular-nums md:justify-end">
        {icono && <ClockIcon className="size-3.5" aria-hidden />}
        {valor}
      </span>
      {detalle && <span className="text-xs text-muted-foreground">{detalle}</span>}
    </span>
  )
}
