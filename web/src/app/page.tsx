import { redirect } from "next/navigation"
import { destinoSinPerfil, getPerfil, inicioPorRol } from "@/lib/auth"

export default async function Inicio() {
  const perfil = await getPerfil()
  redirect(perfil ? inicioPorRol(perfil.rol) : await destinoSinPerfil())
}
