import Link from "next/link"
import { Button } from "@/components/ui/button"
import { NavPrincipal } from "@/components/nav-principal"
import { requerirPerfil } from "@/lib/auth"
import { cerrarSesion } from "../(auth)/actions"

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
      <header className="border-b bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            Solicitudes UPB
          </Link>
          <NavPrincipal enlaces={enlaces} />
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              {perfil.nombre}
              {perfil.rol === "admin" && " · Administración"}
            </span>
            <form action={cerrarSesion}>
              <Button type="submit" variant="ghost" size="sm">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  )
}
