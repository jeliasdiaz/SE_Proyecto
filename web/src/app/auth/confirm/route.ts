import type { EmailOtpType } from "@supabase/supabase-js"
import { NextResponse, type NextRequest } from "next/server"
import { rutaSegura } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

// Destino de los enlaces de los correos de confirmación y de recuperación
// (plantillas en supabase/templates/). Canjea el token por una sesión.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const tipo = searchParams.get("type") as EmailOtpType | null
  const destino = request.nextUrl.clone()
  destino.search = ""

  if (tokenHash && tipo) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash })
    if (!error) {
      destino.pathname = rutaSegura(searchParams.get("next"))
      return NextResponse.redirect(destino)
    }
  }

  destino.pathname = "/login"
  destino.searchParams.set("error", "enlace")
  return NextResponse.redirect(destino)
}
