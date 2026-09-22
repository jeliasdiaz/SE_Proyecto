import type { Metadata } from "next"
// Fuentes locales (vienen en node_modules): no dependen de descargar Google Fonts al compilar.
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import { ProveedorMovimiento } from "@/components/proveedor-movimiento"
import { Toaster } from "@/components/ui/sonner"
import { NOMBRE_APP } from "@/lib/marca"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: NOMBRE_APP,
    template: `%s · ${NOMBRE_APP}`,
  },
  description: "Registro y seguimiento de solicitudes académicas.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      {/* Extensiones como Grammarly agregan atributos al <body> antes de hidratar. */}
      <body className="flex min-h-full flex-col bg-muted/40" suppressHydrationWarning>
        <ProveedorMovimiento>{children}</ProveedorMovimiento>
        <Toaster theme="light" richColors position="top-center" />
      </body>
    </html>
  )
}
