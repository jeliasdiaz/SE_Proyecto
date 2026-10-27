import type { EmailOtpType } from "@supabase/supabase-js"
import { redirect } from "next/navigation"
import type { NextRequest } from "next/server"
import { rutaSegura } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Destino de los enlaces de los correos de confirmación y de recuperación
// (plantillas en supabase/templates/). Canjea el token por una sesión.
// Redirige con rutas relativas: con `next start`, request.nextUrl trae localhost aunque se entre por
// 127.0.0.1 (la site_url local), y la cookie de sesión quedaría en otro origen.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const tipo = searchParams.get("type") as EmailOtpType | null

  if (tokenHash && tipo) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
    if (!error) redirect(rutaSegura(searchParams.get("next")))
  }

  redirect("/login?error=enlace")
}
