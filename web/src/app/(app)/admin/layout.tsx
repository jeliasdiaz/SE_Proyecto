import { requerirPerfil } from "@/lib/auth"

// Defensa en profundidad: aunque un estudiante llegara aquí, RLS solo le devolvería sus filas
// y rechazaría cualquier cambio.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requerirPerfil("admin")
  return children
}
