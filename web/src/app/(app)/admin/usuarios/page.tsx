import type { Metadata } from "next"
import Link from "next/link"
import { UsersIcon } from "lucide-react"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { ETIQUETA_ROL } from "@/lib/dominio"
import { createClient } from "@/lib/supabase/server"
import { BotonRol } from "./boton-rol"
import { BuscadorPersonas } from "./buscador-personas"

export const metadata: Metadata = { title: "Roles del equipo" }

export default async function RolesPage() {
  const perfil = await requerirPerfil("admin")
  const supabase = await createClient()
  // carga_por_asesor ya trae a todo el personal con sus casos abiertos: una sola consulta.
  const { data, error } = await supabase.from("carga_por_asesor").select("id, nombre, correo, rol, pendientes, en_proceso")
  if (error) throw error

  const equipo = data
    .flatMap((p) =>
      p.id && p.rol
        ? [{ id: p.id, nombre: p.nombre ?? "Sin nombre", correo: p.correo ?? "", rol: p.rol, abiertas: (p.pendientes ?? 0) + (p.en_proceso ?? 0) }]
        : []
    )
    // Admins primero; dentro de cada grupo, por nombre.
    .sort((a, b) => (a.rol === b.rol ? a.nombre.localeCompare(b.nombre) : a.rol === "admin" ? -1 : 1))

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Roles del equipo</h1>
          <p className="text-sm text-muted-foreground">Quién tiene acceso a la bandeja de solicitudes.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Equipo ({equipo.length})</CardTitle>
            <CardDescription>Los administradores se asignan fuera de la aplicación.</CardDescription>
          </CardHeader>
          <CardContent>
            {equipo.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersIcon className="size-4" /> Todavía no hay nadie.
              </p>
            ) : (
              <ul className="-mx-2 grid divide-y">
                {equipo.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{p.nombre}</span>
                        <Badge variant="secondary">{ETIQUETA_ROL[p.rol]}</Badge>
                        {p.id === perfil.id && <Badge variant="outline">Tú</Badge>}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{p.correo}</p>
                    </div>
                    {p.rol === "asesor" &&
                      (p.abiertas > 0 ? (
                        // cambiar_rol() lo rechazaría: se explica antes de que lo intente.
                        <p className="text-right text-xs text-muted-foreground">
                          {p.abiertas} {p.abiertas === 1 ? "caso abierto" : "casos abiertos"}
                          <br />
                          <Link
                            href={`/gestion?responsable=${p.id}`}
                            className="font-medium text-foreground underline underline-offset-4"
                          >
                            Reasígnalos para quitarle el rol
                          </Link>
                        </p>
                      ) : (
                        <BotonRol usuarioId={p.id} nombre={p.nombre} accion="degradar" />
                      ))}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Agregar asesor</CardTitle>
            <CardDescription>Busca a alguien que ya se haya registrado y confirmado su correo.</CardDescription>
          </CardHeader>
          <CardContent>
            <BuscadorPersonas />
          </CardContent>
        </Card>
      </div>
    </TransicionPagina>
  )
}
