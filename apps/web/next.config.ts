import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    // Fotos de perfil do GitHub (Avatar).
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  partialPrefetching: true,
  // CSP parcial: só imagens por enquanto (Security Requirements). A política
  // completa, com connect-src da sala e scripts com nonce, entra na Story 2.4.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [{ key: "Content-Security-Policy", value: "img-src 'self' https://avatars.githubusercontent.com" }],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
