import { cache } from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import type { Rol } from "@/lib/dominio"
import type { Tables } from "@/types/database"

export type Perfil = Pick<Tables<"perfiles">, "id" | "nombre" | "correo" | "rol" | "id_estudiantil">

// Una sola consulta por request aunque varios componentes la pidan.
export const getPerfil = cache(async (): Promise<Perfil | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const usuarioId = data?.claims?.sub
  if (!usuarioId) return null

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, id_estudiantil")
    .eq("id", usuarioId)
    .maybeSingle()

  return perfil
})

export function inicioPorRol(rol: Rol): string {
  return rol === "admin" ? "/admin" : "/mis-solicitudes"
}

// Verificación real de acceso para páginas y Server Actions (el proxy solo redirige).
export async function requerirPerfil(rol?: Rol): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil) redirect("/login?error=sesion")
  if (rol && perfil.rol !== rol) redirect(inicioPorRol(perfil.rol))
  return perfil
}

// Evita redirecciones abiertas: solo rutas internas.
export function rutaSegura(valor: FormDataEntryValue | string | null | undefined, porDefecto = "/"): string {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return porDefecto
  }
  return valor
}
