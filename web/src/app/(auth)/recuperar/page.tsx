import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioRecuperar } from "./formulario-recuperar"

export const metadata: Metadata = { title: "Recuperar contraseña" }

export default function RecuperarPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Recuperar contraseña</CardTitle>
        <CardDescription>Te enviaremos un enlace para elegir una contraseña nueva.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioRecuperar />
      </CardContent>
      <CardFooter className="border-t pt-4 text-sm text-muted-foreground">
        <Link href="/login" className="underline-offset-4 hover:underline">
          Volver a iniciar sesión
        </Link>
      </CardFooter>
    </Card>
  )
}
