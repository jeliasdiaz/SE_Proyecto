import Link from "next/link"
import { Marca } from "@/components/marca"
import { MenuUsuario } from "@/components/menu-usuario"
import { NavInferior, NavPrincipal, type Enlace } from "@/components/nav-principal"
import { requerirPerfil } from "@/lib/auth"
import type { Rol } from "@/lib/dominio"

const ENLACES: Record<Rol, Enlace[]> = {
  estudiante: [
    { href: "/mis-solicitudes", etiqueta: "Mis solicitudes", icono: "solicitudes" },
    { href: "/mis-solicitudes/nueva", etiqueta: "Nueva solicitud", icono: "nueva" },
  ],
  asesor: [{ href: "/gestion", etiqueta: "Bandeja", icono: "bandeja" }],
  admin: [
    { href: "/admin", etiqueta: "Asesores", icono: "asesores" },
    { href: "/gestion", etiqueta: "Bandeja", icono: "bandeja" },
    { href: "/admin/metricas", etiqueta: "Métricas", icono: "metricas" },
    { href: "/admin/usuarios", etiqueta: "Usuarios", icono: "usuarios" },
  ],
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil()
  const enlaces = ENLACES[perfil.rol]

  return (
    <>
      {/* viewTransitionName: el header no se desliza con el contenido (ver globals.css). */}
      <header
        style={{ viewTransitionName: "site-header" }}
        className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur"
      >
        <div className="mx-auto flex w-full min-w-0 max-w-6xl items-center gap-6 px-4 py-2">
          <Link href="/" className="min-w-0 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Marca />
          </Link>
          <NavPrincipal enlaces={enlaces} />
          <div className="ml-auto shrink-0">
            <MenuUsuario nombre={perfil.nombre} correo={perfil.correo} rol={perfil.rol} />
          </div>
        </div>
      </header>
      {/* En móvil deja libre el espacio de la barra inferior (64 px + zona segura). */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:py-8">
        {children}
      </main>
      <NavInferior enlaces={enlaces} />
    </>
  )
}
