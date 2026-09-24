"use server"

import { revalidatePath } from "next/cache"
import { requerirPerfil } from "@/lib/auth"
import type { Rol } from "@/lib/dominio"
import { createClient } from "@/lib/supabase/server"
import { esquemaCambioRol, type EstadoFormulario } from "@/lib/validacion"

export type PersonaEncontrada = { id: string; nombre: string; correo: string; rol: Rol; id_estudiantil: string | null }

const MAXIMO_RESULTADOS = 20

export async function buscarPersonas(texto: string): Promise<{ personas: PersonaEncontrada[]; hayMas: boolean }> {
  await requerirPerfil("admin")
  // Sin caracteres con significado en la sintaxis de filtros de PostgREST.
  const q = texto.replace(/[,()"'\\%*]/g, " ").trim().slice(0, 80)
  if (q.length < 2) return { personas: [], hayMas: false }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, correo, rol, id_estudiantil")
    .or(`nombre.ilike.%${q}%,correo.ilike.%${q}%,id_estudiantil.ilike.%${q}%`)
    .order("nombre")
    .limit(MAXIMO_RESULTADOS + 1)
  if (error) throw error
  return { personas: data.slice(0, MAXIMO_RESULTADOS), hayMas: data.length > MAXIMO_RESULTADOS }
}

// cambiar_rol() decide y explica (en español) por qué no se puede: admin solo por SQL, nadie
// cambia su propio rol, no se degrada a un asesor con casos abiertos.
export async function cambiarRol(usuario: string, rol: string): Promise<EstadoFormulario> {
  await requerirPerfil("admin")
  const datos = esquemaCambioRol.safeParse({ usuario, rol })
  if (!datos.success) return { mensaje: "Datos no válidos." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("cambiar_rol", { p_usuario: datos.data.usuario, p_rol: datos.data.rol })
  if (error) {
    if (error.code === "23514") return { mensaje: error.message }
    if (error.code === "42501") return { mensaje: "No tienes permiso para cambiar roles." }
    console.error("Error al cambiar el rol:", error)
    return { mensaje: "No pudimos cambiar el rol. Inténtalo de nuevo." }
  }

  revalidatePath("/admin/usuarios")
  revalidatePath("/admin")
  return {
    ok: true,
    mensaje: datos.data.rol === "asesor" ? "ahora es asesor." : "volvió a ser estudiante.",
  }
}
