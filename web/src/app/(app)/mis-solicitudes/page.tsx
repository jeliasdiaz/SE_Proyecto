import type { Metadata } from "next"
import Link from "next/link"
import { EstadoBadge } from "@/components/estado-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { requerirPerfil } from "@/lib/auth"
import { ETIQUETA_TIPO } from "@/lib/dominio"
import { formatearFecha, tiempoRelativo } from "@/lib/fechas"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Mis solicitudes" }

export default async function MisSolicitudesPage() {
  const perfil = await requerirPerfil("estudiante")
  const supabase = await createClient()
  const { data: solicitudes, error } = await supabase
    .from("solicitudes")
    .select("id, asunto, tipo, estado, origen, creada, actualizada")
    .eq("estudiante_id", perfil.id)
    .order("creada", { ascending: false })
  if (error) throw error

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mis solicitudes</h1>
          <p className="text-sm text-muted-foreground">Estado y avance de cada trámite que has registrado.</p>
        </div>
        <Button asChild>
          <Link href="/mis-solicitudes/nueva">Nueva solicitud</Link>
        </Button>
      </div>

      {solicitudes.length === 0 ? (
        <Card>
          <CardContent className="grid justify-items-center gap-3 py-10 text-center">
            <p className="font-medium">Todavía no tienes solicitudes.</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Registra una homologación, cancelación, supletorio, reingreso o solicitud al comité y sigue su estado
              desde aquí.
            </p>
            <Button asChild variant="outline">
              <Link href="/mis-solicitudes/nueva">Registrar mi primera solicitud</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Asunto</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Registrada</TableHead>
                <TableHead className="pr-4">Último cambio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {solicitudes.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="max-w-80 pl-4">
                    <Link href={`/mis-solicitudes/${s.id}`} className="block truncate font-medium hover:underline">
                      {s.asunto}
                    </Link>
                    {s.origen === "correo" && (
                      <Badge variant="secondary" className="mt-1">
                        Recibida por correo
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{ETIQUETA_TIPO[s.tipo]}</TableCell>
                  <TableCell>
                    <EstadoBadge estado={s.estado} />
                  </TableCell>
                  <TableCell>{formatearFecha(s.creada)}</TableCell>
                  <TableCell className="pr-4 text-muted-foreground">{tiempoRelativo(s.actualizada)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  )
}
