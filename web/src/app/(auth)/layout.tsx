export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <p className="mb-6 text-center text-sm font-medium text-muted-foreground">
          Sistema de Solicitudes Universitarias
        </p>
        {children}
      </div>
    </main>
  )
}
