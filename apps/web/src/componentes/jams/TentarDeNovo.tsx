"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { botaoSecundarioPequeno } from "@/componentes/ui/estilo";
import { tentarDeNovo } from "@/servidor/acoes/jam";
import { useResultadoDaAcao } from "./ResultadoDaAcao";

// Para o criador, quando um amigo não entrou no repositório (front-end spec:
// "não adicionado", com tentar de novo). A página volta do servidor com o
// estado novo; o erro aparece ao lado do botão, que continua na tela (gate da
// 2.3, UX-001). O que deu certo vai para a região da seção, porque o botão
// some quando o amigo entra (gate da 2.4, A11Y-001).
export function TentarDeNovo({ jamId, amigoId, nome }: { jamId: string; amigoId: string; nome: string }) {
  const router = useRouter();
  const anunciar = useResultadoDaAcao();
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState("");
  const [indo, iniciar] = useTransition();
  const botao = useRef<HTMLButtonElement>(null);

  function deuCerto(texto: string) {
    if (anunciar) anunciar({ aviso: texto }, botao.current);
    else setAviso(texto);
  }

  function tentar() {
    setErro(null);
    setAviso("");
    iniciar(async () => {
      const resultado = await semQuebrar(() => tentarDeNovo(jamId, amigoId));
      if (!resultado.ok) {
        setErro(resultado.erro.mensagem);
        // A jam foi excluída (em outra aba, por exemplo): a página volta do servidor sem ela (gate da 2.4, REL-002).
        if (resultado.erro.codigo === "jam_nao_encontrada") router.refresh();
      } else if (resultado.dados.estado === "falhou") setErro(resultado.dados.motivo ?? `${nome} ainda não entrou no repositório.`);
      else if (resultado.dados.estado === "pendente") deuCerto(`Convite enviado: falta ${nome} aceitar no GitHub.`);
      else deuCerto(`${nome} está no repositório agora.`);
    });
  }

  return (
    <>
      <button
        ref={botao}
        type="button"
        disabled={indo}
        onClick={tentar}
        aria-label={`Tentar de novo com ${nome}`}
        className={botaoSecundarioPequeno}
      >
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
