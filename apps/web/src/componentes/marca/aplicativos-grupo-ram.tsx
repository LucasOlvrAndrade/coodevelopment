import type { ReactNode } from "react";

// Aplicativos do Grupo RAM na faixa da página inicial (V1), em branco como os
// logos do componente original. Ícones do Lucide (ISC); o do RAM Firewall é o
// escudo com o T do material do Lucas.

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      {children}
    </svg>
  );
}

const ESCUDO =
  "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z";

export const APLICATIVOS_GRUPO_RAM: { nome: string; icone: ReactNode }[] = [
  {
    nome: "RAM Firewall",
    icone: (
      <Icone>
        <path d={ESCUDO} />
        <path d="M9 10h6" />
        <path d="M12 10v5" />
      </Icone>
    ),
  },
  {
    nome: "Click Fone",
    icone: (
      <Icone>
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384" />
      </Icone>
    ),
  },
  {
    nome: "RAM Backup",
    icone: (
      <Icone>
        <path d="M12 13v8l-4-4" />
        <path d="m12 21 4-4" />
        <path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284" />
      </Icone>
    ),
  },
  {
    nome: "RAM Talk",
    icone: (
      <Icone>
        <path d="M16 10a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 14.286V4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        <path d="M20 9a2 2 0 0 1 2 2v10.286a.71.71 0 0 1-1.212.502l-2.202-2.202A2 2 0 0 0 17.172 19H10a2 2 0 0 1-2-2v-1" />
      </Icone>
    ),
  },
  {
    nome: "RAM Vision",
    icone: (
      <Icone>
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
        <circle cx="12" cy="12" r="3" />
      </Icone>
    ),
  },
  {
    nome: "CRM",
    icone: (
      <Icone>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <path d="M16 3.128a4 4 0 0 1 0 7.744" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <circle cx="9" cy="7" r="4" />
      </Icone>
    ),
  },
];
