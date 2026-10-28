import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Serif, Inter } from "next/font/google";
import "./globals.css";

// As fontes da página inicial valem no app inteiro (V3): Inter no texto e
// Instrument Serif nos títulos. A IBM Plex Mono fica com código, usuário e
// nome de repositório.
const inter = Inter({
  variable: "--fonte-inter",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--fonte-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

const plexMono = IBM_Plex_Mono({
  variable: "--fonte-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Coodevelopment",
  description:
    "Programe junto com seus amigos, cada um com o seu Claude Code, vendo ao vivo o que cada Claude está fazendo.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${instrumentSerif.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
