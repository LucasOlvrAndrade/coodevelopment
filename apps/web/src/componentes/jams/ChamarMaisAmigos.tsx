"use client";

import { useRef, useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { Avatar } from "@/componentes/ui/Avatar";
import { botaoPrincipal, painel } from "@/componentes/ui/estilo";
import { chamarAmigos } from "@/servidor/acoes/jam";
import type { Pessoa } from "@/servidor/dominio/amizade";
import { useResultadoDaAcao } from "./ResultadoDaAcao";

// Na página da jam, o criador chama mais amigos até completar 3 pessoas
// (Story 2.4, AC 2). Usa a mesma ação da nova jam (2.3). Fica sempre na tela
// enquanto a jam está aberta: a página volta do servidor com quem entrou, a
// lista pode esvaziar ou a jam completar, e o resultado aparece na região da
// seção, que não sai da tela (gate da 2.4, A11Y-001).
export function ChamarMaisAmigos({ jamId, amigos, vagas }: { jamId: string; amigos: Pessoa[]; vagas: number }) {
  const anunciar = useResultadoDaAcao();
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [chamando, iniciar] = useTransition();
  const botao = useRef<HTMLButtonElement>(null);

  if (vagas <= 0) {
    return <p className="text-pequeno text-texto-suave">A jam está completa: até 3 pessoas por enquanto.</p>;
  }
  if (amigos.length === 0) {
    return <p className="text-texto-suave">Todos os seus amigos já estão na jam, ou você ainda não tem amigos aqui.</p>;
  }

  function alternar(id: string) {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.length < vagas ? [...atual, id] : atual));
  }

  function chamar() {
    const nomeDe = (id: string) => amigos.find((a) => a.id === id)?.nome ?? "Alguém";
    anunciar?.({}, null);
    iniciar(async () => {
      const resultado = await semQuebrar(() => chamarAmigos(jamId, escolhidos));
      if (!resultado.ok) {
        anunciar?.({ problemas: [resultado.erro.mensagem] }, botao.current);
        return;
      }
      const entraram = resultado.dados.filter((r) => !("erro" in r) && r.estado !== "falhou").map((r) => nomeDe(r.amigoId));
      const problemas = resultado.dados.flatMap((r) =>
        "erro" in r
          ? [`${nomeDe(r.amigoId)}: ${r.erro}`]
          : r.estado === "falhou"
            ? [`${nomeDe(r.amigoId)} não entrou no repositório. ${r.motivo ?? ""}`.trim()]
            : [],
      );
      const aviso = entraram.length > 0 ? `${entraram.join(" e ")} ${entraram.length === 1 ? "está" : "estão"} na jam agora.` : undefined;
      anunciar?.({ aviso, problemas }, botao.current);
      setEscolhidos([]);
    });
  }

  const cheio = escolhidos.length >= vagas;
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-3 text-corpo font-medium">
          Chamar mais amigos{" "}
          <span className="font-normal text-texto-suave">
            ({escolhidos.length} de {vagas} {vagas === 1 ? "vaga" : "vagas"})
          </span>
        </legend>
        <ul className={`${painel} divide-y divide-divisoria overflow-hidden`}>
          {amigos.map((amigo) => {
            const marcado = escolhidos.includes(amigo.id);
            return (
              <li key={amigo.id}>
                <label
                  className={`flex items-center gap-3 px-4 py-3 transition-colors ${!marcado && cheio ? "opacity-60" : "cursor-pointer hover:bg-texto/5"}`}
                >
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!marcado && cheio}
                    onChange={() => alternar(amigo.id)}
                    className="accent-primaria"
                  />
                  <Avatar nome={amigo.nome} foto={amigo.foto} tamanho={24} />
                  {/* Nome e usuário quebram de linha no celular em vez de cortar (gate da 2.4, UX-003). */}
                  <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <span className="break-words">{amigo.nome}</span>
                    <span className="font-mono text-pequeno break-all text-texto-suave">@{amigo.login}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div>
        <button ref={botao} type="button" disabled={escolhidos.length === 0 || chamando} onClick={chamar} className={botaoPrincipal}>
          {chamando ? "Chamando..." : "Chamar para a jam"}
        </button>
      </div>
    </div>
  );
}
