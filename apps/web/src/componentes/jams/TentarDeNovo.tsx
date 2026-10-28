"use client";

import { useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { botaoSecundarioPequeno } from "@/componentes/ui/estilo";
import { tentarDeNovo } from "@/servidor/acoes/jam";

// Para o criador, quando um amigo não entrou no repositório (front-end spec:
// "não adicionado", com tentar de novo). A página volta do servidor com o
// estado novo; o resultado da tentativa aparece aqui (gate da 2.3, UX-001).
export function TentarDeNovo({ jamId, amigoId, nome }: { jamId: string; amigoId: string; nome: string }) {
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [indo, iniciar] = useTransition();

  function tentar() {
    setErro(null);
    setAviso("");
    iniciar(async () => {
      const resultado = await semQuebrar(() => tentarDeNovo(jamId, amigoId));
      if (!resultado.ok) setErro(resultado.erro.mensagem);
      else if (resultado.dados.estado === "falhou") setErro(resultado.dados.motivo ?? `${nome} ainda não entrou no repositório.`);
      else if (resultado.dados.estado === "pendente") setAviso(`Convite enviado: falta ${nome} aceitar no GitHub.`);
    });
  }

  return (
    <>
      <button type="button" disabled={indo} onClick={tentar} aria-label={`Tentar de novo com ${nome}`} className={botaoSecundarioPequeno}>
        {indo ? "Tentando..." : "Tentar de novo"}
      </button>
      {erro && (
        <span role="alert" className="text-pequeno text-erro">
          {erro}
        </span>
      )}
      <span role="status" className="text-pequeno text-texto-suave">
        {aviso}
      </span>
    </>
  );
}
