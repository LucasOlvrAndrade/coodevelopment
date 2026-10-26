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
      className="rounded-controle bg-primaria px-4 py-3 text-corpo font-medium text-sobre-primaria disabled:opacity-60"
    >
      {indo ? "Indo para o GitHub..." : "Entrar com GitHub"}
    </button>
  );
}
