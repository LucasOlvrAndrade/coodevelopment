import { Instrument_Serif, Inter } from "next/font/google";
import type { ReactNode } from "react";

// Fontes só da página inicial (V1), como no componente original: Inter no texto
// e Instrument Serif nos títulos. O resto do app segue com a IBM Plex.
const inter = Inter({
  variable: "--fonte-inter",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--fonte-instrument-serif",
  subsets: ["latin"],
  weight: "400",
});

export default function LayoutPublico({ children }: { children: ReactNode }) {
  return <div className={`${inter.variable} ${instrumentSerif.variable}`}>{children}</div>;
}
