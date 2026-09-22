import Link from "next/link"
import { Marca } from "@/components/marca"
import { MenuUsuario } from "@/components/menu-usuario"
import { NavPrincipal } from "@/components/nav-principal"
import { requerirPerfil } from "@/lib/auth"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const perfil = await requerirPerfil()
  const enlaces =
    perfil.rol === "admin"
      ? [
          { href: "/admin", etiqueta: "Bandeja" },
          { href: "/admin/metricas", etiqueta: "Métricas" },
        ]
      : [
          { href: "/mis-solicitudes", etiqueta: "Mis solicitudes" },
          { href: "/mis-solicitudes/nueva", etiqueta: "Nueva solicitud" },
        ]

  return (
    <>
      {/* viewTransitionName: el header no se desliza con el contenido (ver globals.css). */}
      <header
        style={{ viewTransitionName: "site-header" }}
        className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2">
          <Link href="/" className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            <Marca />
          </Link>
          <NavPrincipal enlaces={enlaces} />
          <div className="ml-auto">
            <MenuUsuario nombre={perfil.nombre} correo={perfil.correo} rol={perfil.rol} />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  )
}
