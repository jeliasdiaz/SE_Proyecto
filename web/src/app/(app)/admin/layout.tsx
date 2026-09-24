import { requerirPerfil } from "@/lib/auth"

// Panel del admin: asesores, roles y métricas. Defensa en profundidad: las vistas filtran por
// es_admin() y cambiar_rol() lo vuelve a comprobar, así que un asesor que llegara aquí vería vacío.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requerirPerfil("admin")
  return children
}
