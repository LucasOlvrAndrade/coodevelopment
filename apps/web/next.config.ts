import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    // Fotos de perfil do GitHub (Avatar).
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  partialPrefetching: true,
  // O protocolo é TypeScript sem build, compartilhado com a sala (Story 2.5).
  transpilePackages: ["@coodevelopment/protocolo"],
  // CSP parcial: só imagens por enquanto (Security Requirements). A política
  // completa, com connect-src da sala e scripts com nonce, ficou como pendência
  // de segurança própria (Story 2.5): hoje nada restringe a conexão com a sala.
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
