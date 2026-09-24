import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { z } from "zod"
import { AvisoSolicitudCreada } from "@/components/aviso-solicitud-creada"
import { BotonActualizar } from "@/components/boton-actualizar"
import { DescargarAdjunto } from "@/components/descargar-adjunto"
import { EstadoBadge } from "@/components/estado-badge"
import { HistorialTimeline, type EventoHistorial } from "@/components/historial-timeline"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { ETIQUETA_TIPO } from "@/lib/dominio"
import { formatearFechaHora } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"
import { PanelRetiro } from "./panel-retiro"

export const metadata: Metadata = { title: "Detalle de solicitud" }

export default async function DetalleSolicitudPage({ params, searchParams }: PageProps<"/mis-solicitudes/[id]">) {
  const { id } = await params
  const { creada } = await searchParams
  if (!z.uuid().safeParse(id).success) notFound()

  const perfil = await requerirPerfil("estudiante")
  const supabase = await createClient()
  const [{ data: solicitud }, { data: historial }] = await Promise.all([
    supabase
      .from("solicitudes")
      .select("id, asunto, tipo, descripcion, estado, observaciones, origen, adjunto_path, creada")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("historial_estados")
      .select("id, estado_anterior, estado_nuevo, observacion, usuario_id, fecha")
      .eq("solicitud_id", id)
      .order("fecha"),
  ])
  if (!solicitud) notFound()

  // El estudiante no puede leer perfiles de otros (RLS), así que el autor se muestra por rol.
  const eventos: EventoHistorial[] = (historial ?? []).map((h) => ({
    id: h.id,
    estadoAnterior: h.estado_anterior,
    estadoNuevo: h.estado_nuevo,
    observacion: h.observacion,
    fecha: h.fecha,
    autor:
      h.usuario_id === perfil.id
        ? "Tú"
        : h.usuario_id
          ? "Coordinación académica"
          : solicitud.origen === "correo" && h.estado_anterior === null
            ? "Recibida por correo"
            : "Sistema",
  }))

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-4">
            <Link
              href="/mis-solicitudes"
              transitionTypes={["nav-back"]}
              className="w-fit text-sm text-muted-foreground hover:underline"
            >
              ← Mis solicitudes
            </Link>
            <BotonActualizar />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{solicitud.asunto}</h1>
            <EstadoBadge estado={solicitud.estado} />
          </div>
          <p className="text-sm text-muted-foreground">
            {ETIQUETA_TIPO[solicitud.tipo]} · Registrada el {formatearFechaHora(solicitud.creada)}
            {solicitud.origen === "correo" && (
              <Badge variant="secondary" className="ml-2">
                Recibida por correo
              </Badge>
            )}
          </p>
        </div>

        {creada === "1" && <AvisoSolicitudCreada />}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="grid content-start gap-6 lg:col-span-2">
            {solicitud.observaciones && (
              <Card>
                <CardHeader>
                  <CardTitle>Respuesta de la coordinación</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap">{solicitud.observaciones}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardHeader>
                <CardTitle>Tu solicitud</CardTitle>
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
          </div>
          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Seguimiento</CardTitle>
              </CardHeader>
              <CardContent>
                <HistorialTimeline eventos={eventos} />
              </CardContent>
            </Card>
            {solicitud.estado === "pendiente" && (
              <Card>
                <CardHeader>
                  <CardTitle>¿Ya no la necesitas?</CardTitle>
                </CardHeader>
                <CardContent>
                  <PanelRetiro solicitudId={solicitud.id} />
                </CardContent>
              </Card>
            )}
            {/* Desde en proceso ya hay un responsable: el retiro lo registra la coordinación. */}
            {solicitud.estado === "en_proceso" && (
              <p className="text-sm text-muted-foreground">
                ¿Quieres desistir? Escríbele a la coordinación académica; ya está gestionando tu caso.
              </p>
            )}
          </div>
        </div>
      </div>
    </TransicionPagina>
  )
}
