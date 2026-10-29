"use client";

import { useState } from "react";
import { clienteAuth } from "./cliente-auth";
import { destinoDepoisDoLogin } from "./destino-depois-do-login";

// Os dois botões da faixa da página inicial (V1): o translúcido do meio e o
// branco do menu, com as classes do componente original.
const VARIANTES = {
  principal: {
    rotulo: "Entrar com GitHub",
    classes:
      "inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/15 disabled:opacity-60",
    icone: (
      <>
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </>
    ),
  },
  menu: {
    rotulo: "Entrar",
    classes:
      "inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-white/90 disabled:opacity-60",
    icone: (
      <>
        <path d="M7 7h10v10" />
        <path d="M7 17 17 7" />
      </>
    ),
  },
};

export function BotaoEntrar({ variante = "principal" }: { variante?: keyof typeof VARIANTES }) {
  const [indo, setIndo] = useState(false);
  const { rotulo, classes, icone } = VARIANTES[variante];

  async function entrar() {
    setIndo(true);
    // Veio do link do conector (?para=/dispositivo...): volta para lá depois do login.
    const para = destinoDepoisDoLogin(new URLSearchParams(window.location.search).get("para"));
    const { error } = await clienteAuth.signIn.social({
      provider: "github",
      callbackURL: para ? `/api/conta/continuar?para=${encodeURIComponent(para)}` : "/api/conta/continuar",
      errorCallbackURL: "/?erro=github",
    });
    if (error) setIndo(false);
  }

  return (
    <button type="button" onClick={entrar} disabled={indo} aria-describedby="aviso-login" className={classes}>
      {indo ? "Indo para o GitHub..." : rotulo}
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        {icone}
      </svg>
    </button>
  );
}
