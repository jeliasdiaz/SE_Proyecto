import type { Metadata } from "next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { FormularioNuevaClave } from "./formulario-nueva-clave"

export const metadata: Metadata = { title: "Nueva contraseña" }

export default async function ActualizarClavePage() {
  await requerirPerfil()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Elige una contraseña nueva</CardTitle>
        <CardDescription>Después de guardarla entrarás directamente a tu cuenta.</CardDescription>
      </CardHeader>
      <CardContent>
        <FormularioNuevaClave />
      </CardContent>
    </Card>
  )
}
