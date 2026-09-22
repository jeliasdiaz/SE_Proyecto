import type { Metadata } from "next"
import { TransicionPagina } from "@/components/transicion-pagina"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { requerirPerfil } from "@/lib/auth"
import { FormularioSolicitud } from "./formulario-solicitud"

export const metadata: Metadata = { title: "Nueva solicitud" }

export default async function NuevaSolicitudPage() {
  const perfil = await requerirPerfil("estudiante")

  return (
    <TransicionPagina>
      <Card className="mx-auto w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-lg">Nueva solicitud</CardTitle>
          <CardDescription>
            Queda registrada como Pendiente. Podrás ver aquí cada cambio de estado y la respuesta de la coordinación.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FormularioSolicitud estudianteId={perfil.id} />
        </CardContent>
      </Card>
    </TransicionPagina>
  )
}
