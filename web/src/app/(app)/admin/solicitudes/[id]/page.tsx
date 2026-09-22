import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeftIcon, ScanSearchIcon } from "lucide-react"
import { z } from "zod"
import { DescargarAdjunto } from "@/components/descargar-adjunto"
import { EstadoBadge } from "@/components/estado-badge"
import { HistorialTimeline, type EventoHistorial } from "@/components/historial-timeline"
import { RevisionBadge } from "@/components/revision-badge"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { ETIQUETA_ORIGEN, ETIQUETA_TIPO } from "@/lib/dominio"
import { formatearFechaHora, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { PanelClasificacion } from "./panel-clasificacion"
import { PanelGestion } from "./panel-gestion"

export const metadata: Metadata = { title: "Gestionar solicitud" }

export default async function GestionSolicitudPage({ params }: PageProps<"/admin/solicitudes/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const perfil = await requerirPerfil("admin")
  const supabase = await createClient()
  const [{ data: solicitud, error }, { data: historial }] = await Promise.all([
    supabase
      .from("solicitudes")
      .select(
        "id, asunto, tipo, descripcion, estado, observaciones, origen, revision, motivo_revision, adjunto_path, creada, actualizada, estudiante:perfiles!solicitudes_estudiante_id_fkey(nombre, correo, id_estudiantil), responsable:perfiles!solicitudes_responsable_id_fkey(nombre)"
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("historial_estados")
      .select("id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha, usuario:perfiles(nombre)")
      .eq("solicitud_id", id)
      .order("fecha"),
  ])
  if (error) throw error
  if (!solicitud) notFound()

  const porRevisar = solicitud.revision === "por_revisar"
  const eventos: EventoHistorial[] = (historial ?? []).map((h) => ({
    id: h.id,
    estadoAnterior: h.estado_anterior,
    estadoNuevo: h.estado_nuevo,
    observacion: h.observacion,
    fecha: h.fecha,
    autor:
      h.usuario_id === perfil.id
        ? "Tú"
        : h.usuario
          ? h.usuario.nombre
          : solicitud.origen === "correo" && h.estado_anterior === null
            ? "Recibida por correo"
            : "Sistema",
  }))

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <Link
            href="/admin"
            transitionTypes={["nav-back"]}
            className="inline-flex w-fit items-center gap-0.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
            Bandeja
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{solicitud.asunto}</h1>
            <EstadoBadge estado={solicitud.estado} />
            {porRevisar && <RevisionBadge motivo={solicitud.motivo_revision} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {ETIQUETA_TIPO[solicitud.tipo]} · Registrada el {formatearFechaHora(solicitud.creada)} · Origen:{" "}
            {ETIQUETA_ORIGEN[solicitud.origen].toLowerCase()} · Último cambio {tiempoRelativo(solicitud.actualizada)}
          </p>
        </div>

        {porRevisar && (
          <Alert className="border-violet-200 bg-violet-50 text-violet-900">
            <ScanSearchIcon />
            <AlertTitle>Clasificación por revisar</AlertTitle>
            <AlertDescription className="text-violet-900/80">
              {solicitud.motivo_revision ?? "El tipo se asignó automáticamente."} Confirma o corrige el tipo en el panel
              Clasificación.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* Mobile-first: en móvil este contenedor no existe (contents) y el orden intercala las
              acciones justo después de la solicitud, en vez de dejarlas bajo todo el historial. */}
          <div className="contents lg:col-span-2 lg:grid lg:content-start lg:gap-6">
            <Card className="order-1">
              <CardHeader>
                <CardTitle>Solicitud</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <p className="whitespace-pre-wrap">{solicitud.descripcion}</p>
                {solicitud.adjunto_path && (
                  <DescargarAdjunto
                    solicitudId={solicitud.id}
                    nombre={solicitud.adjunto_path.split("/").pop() ?? "Adjunto"}
                  />
                )}
              </CardContent>
            </Card>
            {solicitud.observaciones && (
              <Card className="order-3">
                <CardHeader>
                  <CardTitle>Respuesta vigente al estudiante</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{solicitud.observaciones}</p>
                </CardContent>
              </Card>
            )}
            <Card className="order-4">
              <CardHeader>
                <CardTitle>Seguimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <HistorialTimeline eventos={eventos} />
              </CardContent>
            </Card>
          </div>

          {/* Desde lg las acciones quedan a la vista mientras se lee la solicitud. */}
          <div className="order-2 grid content-start gap-6 lg:sticky lg:top-20 lg:order-none">
            <Card>
              <CardHeader>
                <CardTitle>Gestión</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Sin key: tras el cambio, revalidatePath trae el estado nuevo y el panel conserva su mensaje. */}
                <PanelGestion solicitudId={solicitud.id} estadoActual={solicitud.estado} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Clasificación</CardTitle>
              </CardHeader>
              <CardContent>
                <PanelClasificacion solicitudId={solicitud.id} tipoActual={solicitud.tipo} porRevisar={porRevisar} />
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>Estudiante</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm">
                <p className="font-medium">{solicitud.estudiante?.nombre}</p>
                {solicitud.estudiante?.correo && (
                  <a
                    href={`mailto:${solicitud.estudiante.correo}`}
                    className="w-fit text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    {solicitud.estudiante.correo}
                  </a>
                )}
                {solicitud.estudiante?.id_estudiantil && (
                  <p className="text-muted-foreground">ID {solicitud.estudiante.id_estudiantil}</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Responsable: {solicitud.responsable?.nombre ?? "sin asignar"}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TransicionPagina>
  )
}
