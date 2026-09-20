import { requerirPerfil } from "@/lib/auth"

export default async function EstudianteLayout({ children }: { children: React.ReactNode }) {
  await requerirPerfil("estudiante")
  return children
}
