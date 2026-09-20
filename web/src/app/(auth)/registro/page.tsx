import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioRegistro } from "./formulario-registro"

export const metadata: Metadata = { title: "Crear cuenta" }

export default function RegistroPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Crear cuenta de estudiante</CardTitle>
        <CardDescription>
          Usa el mismo correo desde el que escribes a la universidad: así también reconocemos las solicitudes que
          envíes por correo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioRegistro />
      </CardContent>
      <CardFooter className="border-t pt-4 text-sm text-muted-foreground">
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Inicia sesión
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
