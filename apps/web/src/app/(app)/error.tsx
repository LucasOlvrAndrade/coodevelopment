"use client";

import { useEffect } from "react";
import { botaoPrincipal } from "@/componentes/ui/botoes";

// Rede de segurança das páginas internas: em vez da tela de erro padrão do
// Next, uma mensagem em português e "Tentar de novo" (gate da 2.1, A11Y-001).
export default function ErroDaPagina({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex max-w-xl flex-col items-start gap-3">
      <h1 className="text-h1 font-semibold">Algo deu errado</h1>
      <p className="text-texto-suave">A página não carregou direito. Tente de novo; se continuar, recarregue o navegador.</p>
      <button type="button" onClick={() => retry()} className={`${botaoPrincipal} px-4 py-3`}>
        Tentar de novo
      </button>
    </div>
  );
}
