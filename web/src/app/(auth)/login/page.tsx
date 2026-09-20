import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioLogin } from "./formulario-login"

export const metadata: Metadata = { title: "Iniciar sesión" }

const MENSAJES_ERROR: Record<string, string> = {
  sesion: "Tu sesión terminó. Vuelve a iniciar sesión.",
  enlace: "El enlace no es válido o ya expiró. Pide uno nuevo.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams
  const aviso =
    typeof error === "string" && MENSAJES_ERROR[error] ? { ok: false, mensaje: MENSAJES_ERROR[error] } : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Iniciar sesión</CardTitle>
        <CardDescription>Entra para registrar y seguir tus solicitudes.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioLogin next={typeof next === "string" ? next : ""} aviso={aviso} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-1 border-t pt-4 text-sm text-muted-foreground">
        <p>
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="font-medium text-foreground underline-offset-4 hover:underline">
            Regístrate
          </Link>
        </p>
        <Link href="/recuperar" className="underline-offset-4 hover:underline">
          Olvidé mi contraseña
        </Link>
      </CardFooter>
    </Card>
  )
}
