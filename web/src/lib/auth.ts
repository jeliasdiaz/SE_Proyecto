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

const INICIO: Record<Rol, string> = {
  estudiante: "/mis-solicitudes",
  asesor: "/gestion",
  admin: "/admin",
}

export function inicioPorRol(rol: Rol): string {
  return INICIO[rol]
}

// Con sesión pero sin perfil (cuenta creada antes del trigger al_confirmar_correo o perfil borrado):
// el login muestra el aviso en vez de devolverla al inicio, que la mandaría otra vez aquí.
export async function destinoSinPerfil(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return data?.claims ? "/login?error=perfil" : "/login?error=sesion"
}

// Verificación real de acceso para páginas y Server Actions (el proxy solo redirige).
// Acepta un rol o la lista de roles permitidos.
export async function requerirPerfil(roles?: Rol | readonly Rol[]): Promise<Perfil> {
  const perfil = await getPerfil()
  if (!perfil) redirect(await destinoSinPerfil())
  const permitidos: readonly Rol[] | undefined = typeof roles === "string" ? [roles] : roles
  if (permitidos && !permitidos.includes(perfil.rol)) redirect(inicioPorRol(perfil.rol))
  return perfil
}

// Evita redirecciones abiertas: solo rutas internas.
export function rutaSegura(valor: FormDataEntryValue | string | null | undefined, porDefecto = "/"): string {
  if (typeof valor !== "string" || !valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) {
    return porDefecto
  }
  return valor
}
