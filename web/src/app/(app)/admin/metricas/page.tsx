import type { Metadata } from "next"
import Link from "next/link"
import { ChevronRightIcon, ClockIcon } from "lucide-react"
import { EstadoBadge } from "@/components/estado-badge"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DIAS_RECORDATORIO, ESTADOS, ETIQUETA_ESTADO, ETIQUETA_TIPO, TIPOS, type Estado } from "@/lib/dominio"
import { formatearDuracion } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { cn } from "@/lib/utils"
import { BarraDistribucion, BarrasHorizontales, ContadorAnimado, type Fila } from "./graficos"

export const metadata: Metadata = { title: "Métricas" }

const COLOR_ESTADO: Record<Estado, string> = {
  pendiente: "var(--grafico-pendiente)",
  en_proceso: "var(--grafico-en-proceso)",
  finalizada: "var(--grafico-finalizada)",
  rechazada: "var(--grafico-rechazada)",
  retirada: "var(--grafico-retirada)",
}

const PLURAL_ESTADO: Record<Estado, string> = {
  pendiente: "Pendientes",
  en_proceso: "En proceso",
  finalizada: "Finalizadas",
  rechazada: "Rechazadas",
  retirada: "Retiradas",
}

export default async function MetricasPage() {
  const supabase = await createClient()
  const [porEstado, tiempos, estancadas, carga] = await Promise.all([
    supabase.from("metricas_por_estado").select("estado, total"),
    supabase
      .from("metricas_tiempos_por_tipo")
      .select("tipo, total, cerradas, horas_primera_atencion, horas_resolucion"),
    supabase
      .from("solicitudes_estancadas")
      .select("id, asunto, tipo, estado, dias_sin_cambio")
      .order("dias_sin_cambio", { ascending: false }),
    supabase.from("carga_por_asesor").select("id, nombre, finalizadas, rechazadas, horas_resolucion").order("nombre"),
  ])
  if (porEstado.error) throw porEstado.error
  if (tiempos.error) throw tiempos.error
  if (estancadas.error) throw estancadas.error
  if (carga.error) throw carga.error
  const casosEstancados = estancadas.data

  const conteos = Object.fromEntries(
    ESTADOS.map((e) => [e, porEstado.data.find((fila) => fila.estado === e)?.total ?? 0])
  ) as Record<Estado, number>
  const total = ESTADOS.reduce((suma, e) => suma + conteos[e], 0)

  // Mismo orden de tipos en los dos gráficos para que las filas se lean en paralelo.
  const porTipo = TIPOS.flatMap((tipo) => {
    const fila = tiempos.data.find((t) => t.tipo === tipo)
    return fila?.total ? [{ ...fila, tipo, total: fila.total, cerradas: fila.cerradas ?? 0 }] : []
  })
  const filas = (horas: (t: (typeof porTipo)[number]) => number | null): Fila[] =>
    porTipo.map((t) => ({
      clave: t.tipo,
      etiqueta: ETIQUETA_TIPO[t.tipo],
      valor: horas(t),
      texto: formatearDuracion(horas(t)),
      detalle: `${t.total} ${t.total === 1 ? "caso" : "casos"}, ${t.cerradas} ${t.cerradas === 1 ? "cerrado" : "cerrados"}`,
    }))

  // Solo quien ya cerró algún caso: sin cierres no hay tiempo de resolución que comparar.
  const porPersona: Fila[] = carga.data.flatMap((p) => {
    const cerradas = (p.finalizadas ?? 0) + (p.rechazadas ?? 0)
    if (!p.id || cerradas === 0) return []
    return [
      {
        clave: p.id,
        etiqueta: p.nombre ?? "Sin nombre",
        valor: p.horas_resolucion,
        texto: formatearDuracion(p.horas_resolucion),
        detalle: `${cerradas} ${cerradas === 1 ? "caso cerrado" : "casos cerrados"}`,
      },
    ]
  })

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Métricas</h1>
          <p className="text-sm text-muted-foreground">Indicadores del proceso sobre todas las solicitudes.</p>
        </div>

        <Card>
          <CardContent className="grid gap-5">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-6">
              <div className="col-span-2 grid content-start gap-1 sm:col-span-1">
                <dt className="text-sm text-muted-foreground">Solicitudes</dt>
                <dd>
                  <ContadorAnimado valor={total} className="text-4xl font-semibold tracking-tight" />
                </dd>
              </div>
              {ESTADOS.map((estado) => (
                <div key={estado} className="grid content-start gap-1">
                  <dt className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ backgroundColor: COLOR_ESTADO[estado] }}
                    />
                    {PLURAL_ESTADO[estado]}
                  </dt>
                  <dd className="flex items-baseline gap-2">
                    <ContadorAnimado valor={conteos[estado]} className="text-2xl font-semibold tracking-tight" />
                    {total > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {Math.round((conteos[estado] / total) * 100)} %
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
            <BarraDistribucion
              segmentos={ESTADOS.map((estado) => ({
                clave: estado,
                etiqueta: ETIQUETA_ESTADO[estado],
                valor: conteos[estado],
                color: COLOR_ESTADO[estado],
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tiempo promedio por tipo</CardTitle>
            <CardDescription>
              Desde el registro. Primera atención: el caso sale de Pendiente. Resolución: llega a Finalizada o
              Rechazada.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-6">
            {porTipo.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay datos.</p>
            ) : (
              <>
                <div className="grid gap-8 md:grid-cols-2">
                  <BarrasHorizontales titulo="Primera atención" filas={filas((t) => t.horas_primera_atencion)} />
                  <BarrasHorizontales titulo="Resolución" filas={filas((t) => t.horas_resolucion)} />
                </div>
                <details className="group text-sm">
                  <summary className="w-fit text-muted-foreground select-none hover:text-foreground">
                    Ver datos en tabla
                  </summary>
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Casos</TableHead>
                        <TableHead className="text-right">Cerrados</TableHead>
                        <TableHead className="text-right">Primera atención</TableHead>
                        <TableHead className="text-right">Resolución</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {porTipo.map((t) => (
                        <TableRow key={t.tipo}>
                          <TableCell>{ETIQUETA_TIPO[t.tipo]}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.total}</TableCell>
                          <TableCell className="text-right tabular-nums">{t.cerradas}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatearDuracion(t.horas_primera_atencion)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatearDuracion(t.horas_resolucion)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </details>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resolución por responsable</CardTitle>
            <CardDescription>
              Tiempo promedio desde el registro hasta el cierre de los casos que cada persona tiene a su cargo. La carga
              actual está en <Link href="/admin" className="underline underline-offset-4 hover:text-foreground">Equipo</Link>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {porPersona.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía nadie ha cerrado casos.</p>
            ) : (
              <BarrasHorizontales titulo="Resolución" filas={porPersona} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Casos estancados ({casosEstancados.length})</CardTitle>
            <CardDescription>Abiertos y sin cambios desde hace {DIAS_RECORDATORIO} días o más.</CardDescription>
          </CardHeader>
          <CardContent>
            {casosEstancados.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún caso abierto lleva tanto tiempo sin movimiento.</p>
            ) : (
              <ul className="-mx-2 grid">
                {casosEstancados.map((caso) => {
                  const dias = caso.dias_sin_cambio ?? 0
                  return (
                    <li key={caso.id}>
                      <Link
                        href={`/gestion/solicitudes/${caso.id}`}
                        transitionTypes={["nav-forward"]}
                        className="group flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium">{caso.asunto}</span>
                        {caso.tipo && <span className="text-xs text-muted-foreground">{ETIQUETA_TIPO[caso.tipo]}</span>}
                        {caso.estado && <EstadoBadge estado={caso.estado} />}
                        <span
                          className={cn(
                            "inline-flex w-28 items-center justify-end gap-1 text-xs font-medium",
                            dias >= DIAS_RECORDATORIO * 2 ? "text-rose-700" : "text-amber-700"
                          )}
                        >
                          <ClockIcon className="size-3.5" aria-hidden />
                          {dias} días sin cambio
                        </span>
                        <ChevronRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </TransicionPagina>
  )
}
