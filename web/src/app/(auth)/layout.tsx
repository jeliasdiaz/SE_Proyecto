import { Marca } from "@/components/marca"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 pt-12 pb-8 sm:items-center sm:py-12">
      {/* Inputs algo más altos en escritorio (en móvil ya miden 40 px): formularios cortos, sin prisa por la densidad. */}
      <div className="w-full max-w-sm animate-in duration-300 fade-in zoom-in-95 md:[&_[data-slot=input]]:h-9">
        <div className="mb-6 flex justify-center">
          <Marca tamano="lg" />
        </div>
        {children}
      </div>
    </main>
  )
}
