import type { Metadata } from "next"
// Fuentes locales (vienen en node_modules): no dependen de descargar Google Fonts al compilar.
import { GeistMono } from "geist/font/mono"
import { GeistSans } from "geist/font/sans"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: "Solicitudes UPB",
    template: "%s · Solicitudes UPB",
  },
  description: "Registro y seguimiento de solicitudes académicas.",
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-muted/40">
        {children}
        <Toaster theme="light" richColors position="top-center" />
      </body>
    </html>
  )
}
