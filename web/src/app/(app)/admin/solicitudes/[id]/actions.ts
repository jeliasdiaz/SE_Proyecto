"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requerirPerfil } from "@/lib/auth"
import { exigeObservacion } from "@/lib/dominio"
import { createClient } from "@/lib/supabase/server"
import {
  erroresDe,
  esquemaCambioEstado,
  esquemaClasificacion,
  valoresDe,
  type EstadoFormulario,
} from "@/lib/validacion"

// Los mensajes de check_violation los escribimos nosotros en los triggers (en español), así
// que se pueden mostrar tal cual. Cualquier otro error se oculta.
function mensajeDeError(error: { code?: string; message: string }): string {
  if (error.code === "23514") return error.message
  if (error.code === "42501") return "No tienes permiso para hacer este cambio."
  console.error("Error al actualizar la solicitud:", error)
  return "No pudimos guardar el cambio. Inténtalo de nuevo."
}

function refrescar(id: string) {
  revalidatePath(`/admin/solicitudes/${id}`)
  revalidatePath("/admin")
  revalidatePath("/admin/metricas")
}

export async function cambiarEstado(
  solicitudId: string,
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await requerirPerfil("admin")
  const valores = valoresDe(formData, ["estado", "observacion"])
  const id = z.uuid().safeParse(solicitudId)
  const datos = esquemaCambioEstado.safeParse(valores)
  if (!id.success) return { mensaje: "Solicitud no válida." }
  if (!datos.success) return { errores: erroresDe(datos.error), valores }
  if (exigeObservacion(datos.data.estado) && !datos.data.observacion) {
    const motivo = datos.data.estado === "retirada" ? "por qué se retira" : "por qué se rechaza"
    return { errores: { observacion: [`Explica al estudiante ${motivo}.`] }, valores }
  }

  const supabase = await createClient()
  // La validez de la transición la decide el trigger validar_cambio_solicitud().
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ estado: datos.data.estado, observaciones: datos.data.observacion || null })
    .eq("id", id.data)
    .select("id")
  if (error) return { mensaje: mensajeDeError(error), valores }
  if (data.length === 0) return { mensaje: "La solicitud no existe o no tienes acceso a ella.", valores }

  refrescar(id.data)
  return { ok: true, mensaje: "Estado actualizado. El estudiante recibirá el aviso por correo." }
}

export async function clasificarSolicitud(
  solicitudId: string,
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await requerirPerfil("admin")
  const valores = valoresDe(formData, ["tipo"])
  const id = z.uuid().safeParse(solicitudId)
  const datos = esquemaClasificacion.safeParse(valores)
  if (!id.success) return { mensaje: "Solicitud no válida." }
  if (!datos.success) return { errores: erroresDe(datos.error), valores }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ tipo: datos.data.tipo, revision: "ok", motivo_revision: null })
    .eq("id", id.data)
    .select("id")
  if (error) return { mensaje: mensajeDeError(error), valores }
  if (data.length === 0) return { mensaje: "La solicitud no existe o no tienes acceso a ella.", valores }

  refrescar(id.data)
  return { ok: true, mensaje: "Clasificación guardada." }
}
