"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { requerirPerfil } from "@/lib/auth"
import { ROLES_PERSONAL, esEstado, exigeObservacion, esReapertura } from "@/lib/dominio"
import { createClient } from "@/lib/supabase/server"
import {
  erroresDe,
  esquemaCambioEstado,
  esquemaClasificacion,
  esquemaReasignacion,
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

// RLS no deja al asesor alcanzar un caso ajeno: el update no falla, devuelve cero filas.
// Aquí se averigua por qué para decírselo con nombre propio.
async function motivoSinFilas(id: string): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("solicitudes")
    .select("responsable:perfiles!solicitudes_responsable_id_fkey(nombre)")
    .eq("id", id)
    .maybeSingle()
  if (!data) return "La solicitud no existe o no tienes acceso a ella."
  if (data.responsable) return `Esta solicitud ya la atiende ${data.responsable.nombre}.`
  return "No pudimos guardar el cambio. Actualiza la página e inténtalo de nuevo."
}

function refrescar(id: string) {
  revalidatePath(`/gestion/solicitudes/${id}`)
  revalidatePath("/gestion")
  revalidatePath("/admin")
  revalidatePath("/admin/metricas")
}

export async function tomarSolicitud(solicitudId: string): Promise<EstadoFormulario> {
  const perfil = await requerirPerfil(ROLES_PERSONAL)
  const id = z.uuid().safeParse(solicitudId)
  if (!id.success) return { mensaje: "Solicitud no válida." }

  const supabase = await createClient()
  // El filtro responsable_id is null es la garantía: si dos personas la toman a la vez, la segunda
  // espera el bloqueo de la fila y luego ya no la encuentra libre.
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ responsable_id: perfil.id })
    .eq("id", id.data)
    .is("responsable_id", null)
    .select("id")
  if (error) return { mensaje: mensajeDeError(error) }
  if (data.length === 0) return { mensaje: await motivoSinFilas(id.data) }

  refrescar(id.data)
  return { ok: true, mensaje: "La solicitud quedó a tu cargo." }
}

export async function reasignarSolicitud(
  solicitudId: string,
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await requerirPerfil("admin")
  const valores = valoresDe(formData, ["responsable"])
  const id = z.uuid().safeParse(solicitudId)
  const datos = esquemaReasignacion.safeParse(valores)
  if (!id.success) return { mensaje: "Solicitud no válida." }
  if (!datos.success) return { errores: erroresDe(datos.error), valores }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ responsable_id: datos.data.responsable || null })
    .eq("id", id.data)
    .select("id")
  if (error) return { mensaje: mensajeDeError(error), valores }
  if (data.length === 0) return { mensaje: "La solicitud no existe o no tienes acceso a ella.", valores }

  refrescar(id.data)
  return { ok: true, mensaje: datos.data.responsable ? "Responsable actualizado." : "La solicitud quedó sin responsable." }
}

export async function cambiarEstado(
  solicitudId: string,
  estadoActual: string,
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await requerirPerfil(ROLES_PERSONAL)
  const valores = valoresDe(formData, ["estado", "observacion"])
  const id = z.uuid().safeParse(solicitudId)
  const datos = esquemaCambioEstado.safeParse(valores)
  if (!id.success || !esEstado(estadoActual)) return { mensaje: "Solicitud no válida." }
  if (!datos.success) return { errores: erroresDe(datos.error), valores }
  // Solo para dar un mensaje claro: el trigger vuelve a exigirlo con el estado real.
  const destino = datos.data.estado
  if (exigeObservacion(estadoActual, destino) && !datos.data.observacion) {
    const motivo = esReapertura(estadoActual, destino)
      ? "por qué se reabre"
      : destino === "retirada"
        ? "por qué se retira"
        : "por qué se rechaza"
    return { errores: { observacion: [`Explica al estudiante ${motivo}.`] }, valores }
  }

  const supabase = await createClient()
  // La validez de la transición y quién puede hacerla la decide el trigger validar_cambio_solicitud().
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ estado: destino, observaciones: datos.data.observacion || null })
    .eq("id", id.data)
    .select("id")
  if (error) return { mensaje: mensajeDeError(error), valores }
  if (data.length === 0) return { mensaje: await motivoSinFilas(id.data), valores }

  refrescar(id.data)
  return { ok: true, mensaje: "Estado actualizado. El estudiante recibirá el aviso por correo." }
}

export async function clasificarSolicitud(
  solicitudId: string,
  _previo: EstadoFormulario,
  formData: FormData
): Promise<EstadoFormulario> {
  await requerirPerfil(ROLES_PERSONAL)
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
  if (data.length === 0) return { mensaje: await motivoSinFilas(id.data), valores }

  refrescar(id.data)
  return { ok: true, mensaje: "Clasificación guardada." }
}
