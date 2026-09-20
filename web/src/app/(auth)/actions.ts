"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { rutaSegura } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import {
  erroresDe,
  esquemaLogin,
  esquemaNuevaClave,
  esquemaRecuperar,
  esquemaRegistro,
  valoresDe,
  type EstadoFormulario,
} from "@/lib/validacion"

function mensajeDeAuth(codigo: string | undefined, mensaje: string): string {
  switch (codigo) {
    case "invalid_credentials":
      return "Correo o contraseña incorrectos."
    case "email_not_confirmed":
      return "Aún no confirmas tu correo. Revisa tu bandeja de entrada (y la de spam)."
    case "weak_password":
      return "La contraseña es muy débil. Usa al menos 8 caracteres con letras y números."
    case "same_password":
      return "La contraseña nueva debe ser distinta de la actual."
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos y vuelve a intentarlo."
    default:
      console.error("Error de Supabase Auth:", codigo, mensaje)
      return "No pudimos completar la operación. Inténtalo de nuevo."
  }
}

export async function iniciarSesion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(formData, ["correo"])
  const datos = esquemaLogin.safeParse(Object.fromEntries(formData))
  if (!datos.success) return { errores: erroresDe(datos.error), valores }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: datos.data.correo,
    password: datos.data.clave,
  })
  if (error) return { mensaje: mensajeDeAuth(error.code, error.message), valores }

  revalidatePath("/", "layout")
  redirect(rutaSegura(formData.get("next")))
}

export async function registrarse(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(formData, ["nombre", "correo", "idEstudiantil"])
  const datos = esquemaRegistro.safeParse(Object.fromEntries(formData))
  if (!datos.success) return { errores: erroresDe(datos.error), valores }

  const supabase = await createClient()
  // El trigger crea el perfil cuando se confirma el correo. Si el correo ya existe, Supabase
  // responde igual que con uno nuevo (no revela qué cuentas existen).
  const { error } = await supabase.auth.signUp({
    email: datos.data.correo,
    password: datos.data.clave,
    options: {
      data: { nombre: datos.data.nombre, id_estudiantil: datos.data.idEstudiantil },
    },
  })
  if (error) return { mensaje: mensajeDeAuth(error.code, error.message), valores }

  return {
    ok: true,
    mensaje: `Te enviamos un enlace de confirmación a ${datos.data.correo}. Ábrelo para activar tu cuenta.`,
  }
}

export async function solicitarRecuperacion(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const valores = valoresDe(formData, ["correo"])
  const datos = esquemaRecuperar.safeParse(Object.fromEntries(formData))
  if (!datos.success) return { errores: erroresDe(datos.error), valores }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(datos.data.correo)
  if (error) return { mensaje: mensajeDeAuth(error.code, error.message), valores }

  return {
    ok: true,
    mensaje: "Si el correo tiene una cuenta, te llegará un enlace para elegir una contraseña nueva.",
  }
}

export async function actualizarClave(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const datos = esquemaNuevaClave.safeParse(Object.fromEntries(formData))
  if (!datos.success) return { errores: erroresDe(datos.error) }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect("/login?error=sesion")

  const { error } = await supabase.auth.updateUser({ password: datos.data.clave })
  if (error) return { mensaje: mensajeDeAuth(error.code, error.message) }

  revalidatePath("/", "layout")
  redirect("/")
}

export async function cerrarSesion() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
