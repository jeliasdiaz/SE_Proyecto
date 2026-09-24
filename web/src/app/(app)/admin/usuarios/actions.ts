"use server"

import { revalidatePath } from "next/cache"
import { requerirPerfil } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { esquemaCambioRol, type EstadoFormulario } from "@/lib/validacion"

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
    mensaje: datos.data.rol === "asesor" ? "Ahora es asesor." : "Volvió a ser estudiante.",
  }
}
