import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--fonte-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// Só nos títulos da página inicial.
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable} ${instrumentSerif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
