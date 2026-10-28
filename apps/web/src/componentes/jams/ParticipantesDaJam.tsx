import { Avatar } from "@/componentes/ui/Avatar";
import { link, painel } from "@/componentes/ui/estilo";
import type { JamCompleta } from "@/servidor/dominio/jam";
import { TentarDeNovo } from "./TentarDeNovo";

// Cor de cada participante pela vaga, no anel da foto (front-end spec: a cor
// dos participantes é o único elemento colorido forte). Classes fixas, para o
// Tailwind achar.
const COR_DA_VAGA: Record<number, string> = {
  1: "ring-participante-1",
  2: "ring-participante-2",
  3: "ring-participante-3",
};

// Quem está na jam e a situação de cada um no repositório (Story 2.4, AC 1 e 2).
export function ParticipantesDaJam({ jam, eu }: { jam: JamCompleta; eu: string }) {
  const souCriador = jam.criadorId === eu;
  return (
    <ul aria-label="Quem está na jam" className={`${painel} divide-y divide-divisoria`}>
      {jam.participantes.map((p) => (
        <li key={p.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`inline-flex shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-fundo ${COR_DA_VAGA[p.vaga] ?? ""}`}>
              <Avatar nome={p.nome} foto={p.foto} tamanho={40} />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">
                {p.nome}
                {p.id === eu && <span className="font-normal text-texto-suave"> (você)</span>}
              </p>
              <p className="truncate font-mono text-pequeno text-texto-suave">
                @{p.login} · {p.papel === "criador" ? "criou a jam" : "convidado"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-pequeno">
            {p.colaborador === "ok" && <span className="text-sucesso">No repositório</span>}
            {p.colaborador === "pendente" &&
              (p.id === eu ? (
                <a href={`https://github.com/${jam.repoOwner}/${jam.repoNome}/invitations`} className={link}>
                  Aceite o convite do repositório no GitHub
                </a>
              ) : (
                <span className="text-texto-suave">Convite enviado, falta aceitar</span>
              ))}
            {p.colaborador === "falhou" && <span className="text-erro">Não entrou no repositório</span>}
            {/* Em jam que não está aberta, tentar de novo sempre falharia (gate da 2.3, UX-002). */}
            {souCriador && jam.estado === "aberta" && p.papel === "convidado" && p.colaborador !== "ok" && (
              <TentarDeNovo jamId={jam.id} amigoId={p.id} nome={p.nome} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
