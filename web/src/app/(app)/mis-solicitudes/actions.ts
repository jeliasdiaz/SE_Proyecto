"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"
import { requerirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { erroresDe, esquemaNuevaSolicitud, type EstadoFormulario } from "@/lib/validacion"

// Se llama después de subir el adjunto (si hay): el INSERT dispara F1 en n8n y el aviso
// debe encontrar el archivo ya guardado.
export async function crearSolicitud(entrada: unknown): Promise<EstadoFormulario> {
  const perfil = await requerirPerfil("estudiante")
  const datos = esquemaNuevaSolicitud.safeParse(entrada)
  if (!datos.success) return { errores: erroresDe(datos.error) }

  const { id, tipo, asunto, descripcion, adjuntoPath } = datos.data
  if (adjuntoPath && !adjuntoPath.startsWith(`${perfil.id}/${id}/`)) {
    return { mensaje: "El adjunto no corresponde a esta solicitud." }
  }

  const supabase = await createClient()
  // estudiante_id, estado y origen los pone la base de datos (el estudiante no tiene permiso sobre ellos).
  const { error } = await supabase
    .from("solicitudes")
    .insert({ id, tipo, asunto, descripcion, adjunto_path: adjuntoPath })
  if (error) {
    console.error("No se pudo crear la solicitud:", error)
    return { mensaje: "No pudimos registrar la solicitud. Inténtalo de nuevo." }
  }

  revalidatePath("/mis-solicitudes")
  redirect(`/mis-solicitudes/${id}?creada=1`)
}

// El trigger validar_cambio_solicitud() y la política RLS deciden: solo quien la registró, y solo
// mientras siga pendiente. Si el admin la movió antes, el UPDATE no encuentra la fila.
export async function retirarSolicitud(solicitudId: string): Promise<{ ok: true } | { error: string }> {
  await requerirPerfil("estudiante")
  const id = z.uuid().safeParse(solicitudId)
  if (!id.success) return { error: "Solicitud no válida." }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("solicitudes")
    .update({ estado: "retirada" })
    .eq("id", id.data)
    .select("id")
  if (error) {
    if (error.code === "23514") return { error: error.message }
    console.error("No se pudo retirar la solicitud:", error)
    return { error: "No pudimos retirar la solicitud. Inténtalo de nuevo." }
  }
  if (data.length === 0) {
    return { error: "La solicitud ya no se puede retirar: la coordinación empezó a gestionarla." }
  }

  revalidatePath("/mis-solicitudes")
  revalidatePath(`/mis-solicitudes/${id.data}`)
  return { ok: true }
}
