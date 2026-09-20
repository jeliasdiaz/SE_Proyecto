import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import type { Database } from "@/types/database"

const RUTAS_PUBLICAS = ["/login", "/registro", "/recuperar", "/auth/"]
const RUTAS_SOLO_ANONIMAS = ["/login", "/registro", "/recuperar"]

function empiezaCon(ruta: string, prefijos: string[]) {
  return prefijos.some((p) => ruta === p || ruta.startsWith(p.endsWith("/") ? p : `${p}/`))
}

// Refresca la sesión en cada request y hace una redirección optimista.
// No es la verificación de permisos: esa la hacen las páginas (lib/auth.ts) y RLS.
export async function updateSession(request: NextRequest) {
  let respuesta = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          respuesta = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([clave, valor]) => respuesta.headers.set(clave, valor))
        },
      },
    }
  )

  // No poner código entre createServerClient y getClaims(): rompe el refresco de la sesión.
  const { data } = await supabase.auth.getClaims()
  const conSesion = Boolean(data?.claims)
  const ruta = request.nextUrl.pathname

  const redirigir = (destino: URL) => {
    const redireccion = NextResponse.redirect(destino)
    respuesta.cookies.getAll().forEach((cookie) => redireccion.cookies.set(cookie))
    return redireccion
  }

  if (!conSesion && !empiezaCon(ruta, RUTAS_PUBLICAS)) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/login"
    destino.search = ""
    if (ruta !== "/") destino.searchParams.set("next", ruta)
    return redirigir(destino)
  }

  if (conSesion && empiezaCon(ruta, RUTAS_SOLO_ANONIMAS)) {
    const destino = request.nextUrl.clone()
    destino.pathname = "/"
    destino.search = ""
    return redirigir(destino)
  }

  return respuesta
}
