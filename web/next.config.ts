import type { NextConfig } from "next";

/**
 * Exportación estática (sin backend). Para GitHub Pages en un subdirectorio,
 * define NEXT_PUBLIC_BASE_PATH=/nombre-del-repo al construir.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || undefined;

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
