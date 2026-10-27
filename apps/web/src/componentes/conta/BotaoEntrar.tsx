"use client";

import { useState } from "react";
import { clienteAuth } from "./cliente-auth";

export function BotaoEntrar() {
  const [indo, setIndo] = useState(false);

  async function entrar() {
    setIndo(true);
    const { error } = await clienteAuth.signIn.social({
      provider: "github",
      callbackURL: "/api/conta/continuar",
      errorCallbackURL: "/?erro=github",
    });
    if (error) setIndo(false);
  }

  return (
    <button
      type="button"
      onClick={entrar}
      disabled={indo}
      aria-describedby="aviso-login"
      className="inline-flex items-center gap-2 rounded-full bg-primaria px-5 py-3 text-corpo font-medium text-sobre-primaria ring-1 ring-white/15 transition-[filter] hover:brightness-110 disabled:opacity-60"
    >
      {indo ? "Indo para o GitHub..." : "Entrar com GitHub"}
      <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </button>
  );
}
