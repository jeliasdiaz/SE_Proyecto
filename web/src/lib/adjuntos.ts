"use server"

import { z } from "zod"
import { requerirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

type Resultado = { url: string } | { error: string }

// URL firmada de un minuto (R5: el bucket es privado). RLS de Storage decide si el usuario
// puede leer el archivo: el estudiante solo los suyos, el admin todos.
export async function obtenerUrlAdjunto(solicitudId: string): Promise<Resultado> {
  await requerirPerfil()
  const id = z.uuid().safeParse(solicitudId)
  if (!id.success) return { error: "Solicitud no válida." }

  const supabase = await createClient()
  const { data: solicitud } = await supabase
    .from("solicitudes")
    .select("adjunto_path")
    .eq("id", id.data)
    .maybeSingle()
  if (!solicitud?.adjunto_path) return { error: "Esta solicitud no tiene adjunto." }

  const nombre = solicitud.adjunto_path.split("/").pop()
  const { data, error } = await supabase.storage
    .from("adjuntos")
    .createSignedUrl(solicitud.adjunto_path, 60, { download: nombre ?? true })
  if (error || !data) return { error: "No pudimos abrir el adjunto." }

  return { url: data.signedUrl }
}
