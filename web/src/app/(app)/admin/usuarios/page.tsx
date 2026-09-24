import type { Metadata } from "next"
import { SearchIcon, UsersIcon } from "lucide-react"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { requerirPerfil } from "@/lib/auth"
import { ETIQUETA_ROL, ROLES_PERSONAL, type Rol } from "@/lib/dominio"
import { createClient } from "@/lib/supabase/server"
import { BotonRol } from "./boton-rol"

export const metadata: Metadata = { title: "Usuarios" }

const MAXIMO_RESULTADOS = 20

type Persona = { id: string; nombre: string; correo: string; rol: Rol; id_estudiantil: string | null }

export default async function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const { q: valor } = await searchParams
  // Sin caracteres con significado en la sintaxis de filtros de PostgREST.
  const q = (typeof valor === "string" ? valor : "")
    .replace(/[,()"'\\%*]/g, " ")
    .trim()
    .slice(0, 80)
  const perfil = await requerirPerfil("admin")
  const supabase = await createClient()

  const columnas = "id, nombre, correo, rol, id_estudiantil"
  const [personal, busqueda] = await Promise.all([
    supabase.from("perfiles").select(columnas).in("rol", ROLES_PERSONAL).order("rol").order("nombre"),
    q
      ? supabase
          .from("perfiles")
          .select(columnas)
          .or(`nombre.ilike.%${q}%,correo.ilike.%${q}%,id_estudiantil.ilike.%${q}%`)
          .order("nombre")
          .limit(MAXIMO_RESULTADOS)
      : Promise.resolve({ data: null, error: null }),
  ])
  if (personal.error) throw personal.error
  if (busqueda.error) throw busqueda.error

  return (
    <TransicionPagina>
      <div className="grid gap-6">
        <div>
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Usuarios</h1>
          <p className="text-sm text-muted-foreground">
            Da o quita el rol de asesor. El rol de administrador solo se asigna directamente en la base de datos.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Buscar persona</CardTitle>
            <CardDescription>
              Solo aparecen quienes ya confirmaron su correo. Para sumar a alguien nuevo, primero debe registrarse.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action="/admin/usuarios" role="search" className="relative">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                name="q"
                type="search"
                defaultValue={q}
                placeholder="Nombre, correo o ID estudiantil"
                aria-label="Buscar por nombre, correo o ID estudiantil"
                className="pl-9"
              />
            </form>
            {busqueda.data &&
              (busqueda.data.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nadie coincide con «{q}».</p>
              ) : (
                <ListaPersonas personas={busqueda.data} yo={perfil.id} />
              ))}
            {busqueda.data?.length === MAXIMO_RESULTADOS && (
              <p className="text-xs text-muted-foreground">
                Se muestran los primeros {MAXIMO_RESULTADOS}. Escribe algo más específico para acotar.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Coordinación ({personal.data.length})</CardTitle>
            <CardDescription>Administradores y asesores con acceso a la bandeja.</CardDescription>
          </CardHeader>
          <CardContent>
            {personal.data.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <UsersIcon className="size-4" /> Todavía no hay nadie.
              </p>
            ) : (
              <ListaPersonas personas={personal.data} yo={perfil.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </TransicionPagina>
  )
}

function ListaPersonas({ personas, yo }: { personas: Persona[]; yo: string }) {
  return (
    <ul className="-mx-2 grid divide-y">
      {personas.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{p.nombre}</span>
              <Badge variant={p.rol === "estudiante" ? "outline" : "secondary"}>{ETIQUETA_ROL[p.rol]}</Badge>
              {p.id === yo && <span className="text-xs text-muted-foreground">(tú)</span>}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {p.correo}
              {p.id_estudiantil && ` · ID ${p.id_estudiantil}`}
            </p>
          </div>
          <AccionRol persona={p} yo={yo} />
        </li>
      ))}
    </ul>
  )
}

// Mismas reglas que cambiar_rol(): la base de datos las vuelve a comprobar.
function AccionRol({ persona, yo }: { persona: Persona; yo: string }) {
  if (persona.id === yo || persona.rol === "admin") {
    return <span className="text-xs text-muted-foreground">Solo por base de datos</span>
  }
  return (
    <BotonRol
      usuarioId={persona.id}
      nombre={persona.nombre}
      accion={persona.rol === "estudiante" ? "promover" : "degradar"}
    />
  )
}
