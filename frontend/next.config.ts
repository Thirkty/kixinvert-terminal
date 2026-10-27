import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== "production";

// `npm run build` genera archivos estáticos en `out/`, que FastAPI sirve en el puerto 8000:
// una sola app y una sola dirección. `npm run dev` (puerto 3000) es solo para editar con
// recarga en caliente y reenvía /api al backend.
const nextConfig: NextConfig = {
  output: isDev ? undefined : "export",
  turbopack: {
    root: path.resolve(__dirname),
  },
  ...(isDev && {
    async rewrites() {
      return [
        {
          source: "/api/:path*",
          destination: "http://127.0.0.1:8000/api/:path*",
        },
      ];
    },
  }),
};

export default nextConfig;
