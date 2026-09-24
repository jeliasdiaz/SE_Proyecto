import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  redirects() {
    return [
      // La bandeja se movió de /admin a /gestion al crear el rol asesor. Los correos ya enviados
      // (F1) enlazan a la ruta vieja. Temporal: /admin/solicitudes podría volver a usarse.
      {
        source: "/admin/solicitudes/:id",
        destination: "/gestion/solicitudes/:id",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
