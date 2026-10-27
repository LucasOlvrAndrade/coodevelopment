"use client";

import { useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { botaoSecundario } from "@/componentes/ui/botoes";
import { tentarDeNovo } from "@/servidor/acoes/jam";

// Para o criador, quando um amigo não entrou no repositório (front-end spec:
// "não adicionado", com tentar de novo). A página volta do servidor com o
// estado novo.
export function TentarDeNovo({ jamId, amigoId, nome }: { jamId: string; amigoId: string; nome: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [indo, iniciar] = useTransition();

  function tentar() {
    setErro(null);
    iniciar(async () => {
      const resultado = await semQuebrar(() => tentarDeNovo(jamId, amigoId));
      if (!resultado.ok) setErro(resultado.erro.mensagem);
    });
  }

  return (
    <>
      <button type="button" disabled={indo} onClick={tentar} aria-label={`Tentar de novo com ${nome}`} className={`${botaoSecundario} py-1 text-pequeno`}>
        {indo ? "Tentando..." : "Tentar de novo"}
      </button>
      {erro && (
        <span role="alert" className="text-pequeno text-erro">
          {erro}
        </span>
      )}
    </>
  );
}
