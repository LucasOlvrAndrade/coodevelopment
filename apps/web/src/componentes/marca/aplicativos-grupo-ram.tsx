import type { ReactNode } from "react";

// Aplicativos do Grupo RAM na faixa da página inicial (V1), em branco como os
// logos do componente original. Ícones oficiais, os mesmos do acesso rápido de
// apps.gruporam.com.br, e os mesmos endereços de lá (APP_URLS).

function Icone({ children }: { children: ReactNode }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5 shrink-0">
      {children}
    </svg>
  );
}

export const APLICATIVOS_GRUPO_RAM: { nome: string; url: string; icone: ReactNode }[] = [
  {
    nome: "RAM Firewall",
    url: "https://fw.gruporam.com.br",
    icone: (
      <Icone>
        <path d="M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z" />
        <path d="M8 11h8M12 11v4M10 15h4" />
      </Icone>
    ),
  },
  {
    nome: "Click Fone",
    url: "https://portal.clickfone.com.br",
    icone: (
      <Icone>
        <path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
      </Icone>
    ),
  },
  {
    nome: "RAM Backup",
    url: "https://rbc.gruporam.com.br",
    icone: (
      <Icone>
        <path d="M6.5 18a4.5 4.5 0 1 1 .9-8.9 6 6 0 0 1 11.6 1.6A3.7 3.7 0 0 1 18 18h-3" />
        <path d="M12 13v7M9.5 17.5L12 20l2.5-2.5" />
      </Icone>
    ),
  },
  {
    nome: "RAM Talk",
    url: "https://ramtalk.gruporam.com.br",
    icone: (
      <Icone>
        <path d="M4 5h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
        <path d="M20 9h1a1 1 0 0 1 1 1v9l-3-2h-5" />
      </Icone>
    ),
  },
  {
    nome: "RAM Vision",
    url: "https://ramvision.gruporam.com.br",
    icone: (
      <Icone>
        <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
        <circle cx="12" cy="12" r="3" />
      </Icone>
    ),
  },
  {
    nome: "CRM",
    url: "https://crm.gruporam.com.br",
    icone: (
      <Icone>
        <circle cx="9" cy="8" r="3.2" />
        <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
        <path d="M16 4.5a3.2 3.2 0 0 1 0 7M17.5 14.6a5.5 5.5 0 0 1 3 4.9" />
      </Icone>
    ),
  },
];
