import type { Metadata } from "next"
import Link from "next/link"
import { BotonActualizar } from "@/components/boton-actualizar"
import { EstadoBadge } from "@/components/estado-badge"
import { TransicionPagina } from "@/components/transicion-pagina"
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
    <TransicionPagina>
      <div className="grid gap-6">
        <div className="flex items-start justify-between gap-4 sm:items-end">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">Mis solicitudes</h1>
            <p className="text-sm text-muted-foreground">Estado y avance de cada trámite que has registrado.</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <BotonActualizar />
            {/* En móvil la barra inferior ya ofrece "Nueva solicitud". */}
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/mis-solicitudes/nueva">Nueva solicitud</Link>
            </Button>
          </div>
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
            {/* Mobile-first: tarjetas en móvil, tabla desde md (mismo marcado que la bandeja). */}
            <Table className="block md:table">
              <TableHeader className="hidden md:table-header-group">
                <TableRow>
                  <TableHead className="pl-4">Asunto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Registrada</TableHead>
                  <TableHead className="pr-4">Último cambio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="block md:table-row-group">
                {solicitudes.map((s) => (
                  <TableRow
                    key={s.id}
                    className="relative flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 md:table-row md:p-0"
                  >
                    <TableCell className="block basis-full p-0 whitespace-normal md:table-cell md:p-2 md:pl-4 md:whitespace-nowrap">
                      <div className="flex items-start justify-between gap-3">
                        {/* Enlace estirado: el ::after cubre toda la fila, pero sigue siendo un <a> real. */}
                        <Link
                          href={`/mis-solicitudes/${s.id}`}
                          transitionTypes={["nav-forward"]}
                          className="line-clamp-2 min-w-0 font-medium outline-none after:absolute after:inset-0 hover:underline focus-visible:after:ring-2 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset md:block md:max-w-80 md:truncate"
                        >
                          {s.asunto}
                        </Link>
                        <EstadoBadge estado={s.estado} className="shrink-0 md:hidden" />
                      </div>
                      {s.origen === "correo" && (
                        <Badge variant="secondary" className="mt-1">
                          Recibida por correo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="block p-0 text-xs text-muted-foreground md:table-cell md:p-2 md:text-sm md:text-foreground">
                      {ETIQUETA_TIPO[s.tipo]}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <EstadoBadge estado={s.estado} />
                    </TableCell>
                    <TableCell className="block p-0 text-xs text-muted-foreground before:mr-2 before:content-['·'] md:table-cell md:p-2 md:text-sm md:text-foreground md:before:content-none">
                      <time dateTime={s.creada}>{formatearFecha(s.creada)}</time>
                    </TableCell>
                    <TableCell className="ml-auto block p-0 text-xs text-muted-foreground md:table-cell md:p-2 md:pr-4 md:text-sm">
                      <time dateTime={s.actualizada}>{tiempoRelativo(s.actualizada)}</time>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </TransicionPagina>
  )
}
