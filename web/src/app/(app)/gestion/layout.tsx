import { RefrescoEnVivo } from "@/components/refresco-en-vivo"
import { requerirPerfil } from "@/lib/auth"
import { ROLES_PERSONAL } from "@/lib/dominio"

// Bandeja de la coordinación: asesores y admin. Defensa en profundidad: aunque un estudiante
// llegara aquí, RLS solo le devolvería sus filas y rechazaría cualquier cambio.
export default async function GestionLayout({ children }: { children: React.ReactNode }) {
  await requerirPerfil(ROLES_PERSONAL)
  return (
    <>
      {children}
      <RefrescoEnVivo />
    </>
  )
}
