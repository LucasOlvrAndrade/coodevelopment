"use client";

import { useState, useTransition } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { Avatar } from "@/componentes/ui/Avatar";
import { botaoPrincipal } from "@/componentes/ui/botoes";
import { chamarAmigos } from "@/servidor/acoes/jam";
import type { Pessoa } from "@/servidor/dominio/amizade";

// Na página da jam, o criador chama mais amigos até completar 3 pessoas
// (Story 2.4, AC 2). Usa a mesma ação da nova jam (2.3); a página volta do
// servidor com quem entrou, e o que não deu certo aparece aqui.
export function ChamarMaisAmigos({ jamId, amigos, vagas }: { jamId: string; amigos: Pessoa[]; vagas: number }) {
  const [escolhidos, setEscolhidos] = useState<string[]>([]);
  const [problemas, setProblemas] = useState<string[]>([]);
  const [aviso, setAviso] = useState("");
  const [chamando, iniciar] = useTransition();

  if (amigos.length === 0) {
    return <p className="text-texto-suave">Todos os seus amigos já estão na jam, ou você ainda não tem amigos aqui.</p>;
  }

  function alternar(id: string) {
    setEscolhidos((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : atual.length < vagas ? [...atual, id] : atual));
  }

  function chamar() {
    setProblemas([]);
    setAviso("");
    const nomeDe = (id: string) => amigos.find((a) => a.id === id)?.nome ?? "Alguém";
    iniciar(async () => {
      const resultado = await semQuebrar(() => chamarAmigos(jamId, escolhidos));
      if (!resultado.ok) {
        setProblemas([resultado.erro.mensagem]);
        return;
      }
      const deram = resultado.dados.filter((r) => !("erro" in r) && r.estado !== "falhou").map((r) => nomeDe(r.amigoId));
      setProblemas(
        resultado.dados.flatMap((r) =>
          "erro" in r
            ? [`${nomeDe(r.amigoId)}: ${r.erro}`]
            : r.estado === "falhou"
              ? [`${nomeDe(r.amigoId)} não entrou no repositório. ${r.motivo ?? ""}`.trim()]
              : [],
        ),
      );
      if (deram.length > 0) setAviso(`${deram.join(" e ")} ${deram.length === 1 ? "foi chamado" : "foram chamados"} para a jam.`);
      setEscolhidos([]);
    });
  }

  const cheio = escolhidos.length >= vagas;
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-corpo font-medium">
          Chamar mais amigos{" "}
          <span className="font-normal text-texto-suave">
            ({escolhidos.length} de {vagas} {vagas === 1 ? "vaga" : "vagas"})
          </span>
        </legend>
        <ul className="flex flex-col gap-1">
          {amigos.map((amigo) => {
            const marcado = escolhidos.includes(amigo.id);
            return (
              <li key={amigo.id}>
                <label className={`flex items-center gap-3 rounded-controle px-2 py-2 ${!marcado && cheio ? "opacity-60" : "cursor-pointer"}`}>
                  <input
                    type="checkbox"
                    checked={marcado}
                    disabled={!marcado && cheio}
                    onChange={() => alternar(amigo.id)}
                    className="accent-primaria"
                  />
                  <Avatar nome={amigo.nome} foto={amigo.foto} tamanho={24} />
                  <span>{amigo.nome}</span>
                  <span className="font-mono text-pequeno text-texto-suave">@{amigo.login}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div>
        <button type="button" disabled={escolhidos.length === 0 || chamando} onClick={chamar} className={botaoPrincipal}>
          {chamando ? "Chamando..." : "Chamar para a jam"}
        </button>
      </div>
      {problemas.length > 0 && (
        <ul role="alert" className="list-disc pl-5 text-pequeno text-erro">
          {problemas.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <p role="status" className="text-corpo">
        {aviso}
      </p>
    </div>
  );
}
