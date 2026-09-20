import { redirect } from "next/navigation"
import { getPerfil, inicioPorRol } from "@/lib/auth"

export default async function Inicio() {
  const perfil = await getPerfil()
  redirect(perfil ? inicioPorRol(perfil.rol) : "/login")
}
