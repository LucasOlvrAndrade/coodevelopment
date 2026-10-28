"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import { semQuebrar } from "@/componentes/ui/acao-segura";
import { Avatar } from "@/componentes/ui/Avatar";
import { botaoPrincipalGrande, painel } from "@/componentes/ui/estilo";
import { chamarAmigos } from "@/servidor/acoes/jam";
import type { Pessoa } from "@/servidor/dominio/amizade";

const MAXIMO = 2;

type Escolhido = { id: string; nome: string };
type Escolha = { escolhidos: Escolhido[]; alternar: (amigo: Escolhido) => void };
const Contexto = createContext<Escolha>({ escolhidos: [], alternar: () => {} });

// Amigos escolhidos na nova jam (Story 2.3), lidos pelos dois jeitos de criar
// (importar e criar repositório) na hora de chamar depois que a jam existe.
export function AmigosDaJam({ children }: { children: ReactNode }) {
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([]);
  function alternar(amigo: Escolhido) {
    setEscolhidos((atual) =>
      atual.some((a) => a.id === amigo.id) ? atual.filter((a) => a.id !== amigo.id) : atual.length < MAXIMO ? [...atual, amigo] : atual,
    );
  }
  return <Contexto.Provider value={{ escolhidos, alternar }}>{children}</Contexto.Provider>;
}

// Depois de criar a jam: chama os escolhidos e vai ao Início. Se algum não
// entrou (regra, GitHub, falta de rede), mostra o que houve antes de sair da
// tela, com o link para o Início, onde dá para tentar de novo (gate da 2.3, UX-001).
export function useFinalizarCriacao() {
  const router = useRouter();
  const { escolhidos } = useContext(Contexto);
  const [depois, setDepois] = useState<{ jamId: string; problemas: string[] } | null>(null);

  async function finalizar(jamId: string) {
    const destino = `/inicio?nova=${encodeURIComponent(jamId)}`;
    if (escolhidos.length === 0) {
      router.push(destino);
      return;
    }
    const resultado = await semQuebrar(() => chamarAmigos(jamId, escolhidos.map((a) => a.id)));
    const nomeDe = (id: string) => escolhidos.find((a) => a.id === id)?.nome ?? "Alguém";
    const problemas = !resultado.ok
      ? [`A jam foi criada, mas ninguém foi chamado: ${resultado.erro.mensagem}`]
      : resultado.dados.flatMap((r) =>
          "erro" in r
            ? [`${nomeDe(r.amigoId)}: ${r.erro}`]
            : r.estado === "falhou"
              ? [`${nomeDe(r.amigoId)} não entrou no repositório. ${r.motivo ?? ""}`.trim()]
              : [],
        );
    if (problemas.length === 0) router.push(destino);
    else setDepois({ jamId, problemas });
  }

  const aviso = depois && (
    <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-alerta/10 p-5 ring-1 ring-alerta/40">
      <p className="font-medium">A jam foi criada, mas nem todo mundo entrou.</p>
      <ul className="list-disc pl-5 text-corpo">
        {depois.problemas.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      <div>
        <Link href={`/inicio?nova=${encodeURIComponent(depois.jamId)}`} className={botaoPrincipalGrande}>
          Ir para o Início
        </Link>
      </div>
    </div>
  );

  return { finalizar, aviso };
}

// Só amigos aparecem, no máximo 2 (FR5, FR6), com o contador "0 de 2" (front-end spec).
export function EscolherAmigos({ amigos }: { amigos: Pessoa[] }) {
  const { escolhidos, alternar } = useContext(Contexto);
  if (amigos.length === 0) {
    return <p className="text-texto-suave">Você ainda não tem amigos aqui. Dá para criar a jam sozinho e chamar depois.</p>;
  }
  const cheio = escolhidos.length >= MAXIMO;
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-3 text-corpo font-medium">
        Chamar amigos <span className="font-normal text-texto-suave">(opcional, {escolhidos.length} de {MAXIMO})</span>
      </legend>
      <ul className={`${painel} divide-y divide-divisoria overflow-hidden`}>
        {amigos.map((amigo) => {
          const marcado = escolhidos.some((a) => a.id === amigo.id);
          return (
            <li key={amigo.id}>
              <label
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${!marcado && cheio ? "opacity-60" : "cursor-pointer hover:bg-texto/5"}`}
              >
                <input
                  type="checkbox"
                  checked={marcado}
                  disabled={!marcado && cheio}
                  onChange={() => alternar({ id: amigo.id, nome: amigo.nome })}
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
      {cheio && <p className="text-pequeno text-texto-suave">Uma jam tem até 3 pessoas, contando você.</p>}
    </fieldset>
  );
}
