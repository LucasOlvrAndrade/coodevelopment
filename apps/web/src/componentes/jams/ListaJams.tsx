import { Avatar } from "@/componentes/ui/Avatar";
import type { JamDoInicio } from "@/servidor/dominio/jam";
import { TentarDeNovo } from "./TentarDeNovo";

// Jams do Início (FR7): lista simples, abertas primeiro (front-end spec). A
// página da jam chega na Story 2.4; até lá o item não tem link. Convidado que
// ainda não está no repositório aparece com o estado (Story 2.3): o criador
// pode tentar de novo, e o amigo vê o link do convite do GitHub.
export function ListaJams({ jams, eu, nova }: { jams: JamDoInicio[]; eu: string; nova?: string }) {
  return (
    <ul aria-label="Suas jams" className="w-full divide-y divide-divisoria">
      {jams.map((jam) => {
        const destaque = jam.id === nova;
        const souCriador = jam.criadorId === eu;
        const foraDoRepositorio = jam.participantes.filter((p) => p.papel === "convidado" && p.colaborador !== "ok");
        return (
          <li key={jam.id} className={`flex flex-col gap-2 py-3 ${destaque ? "bg-superficie px-3" : ""}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate font-mono text-corpo font-medium">
                  {jam.repoOwner}/{jam.repoNome}
                </p>
                <p className="text-pequeno text-texto-suave">
                  {destaque ? "Jam criada agora · " : ""}
                  {jam.estado === "fechada" ? "Fechada" : "Aberta"} · código {jam.id}
                </p>
              </div>
              <ul aria-label={`Quem está na jam ${jam.repoNome}`} className="flex items-center gap-1">
                {jam.participantes.map((p) => (
                  <li key={p.id} title={p.nome} className="flex items-center">
                    <Avatar nome={p.nome} foto={p.foto} tamanho={24} />
                    <span className="sr-only">{p.nome}</span>
                  </li>
                ))}
              </ul>
            </div>
            {foraDoRepositorio.length > 0 && (
              <ul className="flex flex-col gap-1">
                {foraDoRepositorio.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 text-pequeno">
                    {p.id === eu ? (
                      p.colaborador === "pendente" ? (
                        <a
                          href={`https://github.com/${jam.repoOwner}/${jam.repoNome}/invitations`}
                          className="font-medium text-destaque underline underline-offset-2"
                        >
                          Aceite o convite do repositório no GitHub
                        </a>
                      ) : (
                        <span className="text-texto-suave">Você ainda não foi adicionado ao repositório; quem criou a jam pode tentar de novo.</span>
                      )
                    ) : (
                      <>
                        <span className={p.colaborador === "falhou" ? "text-erro" : "text-texto-suave"}>
                          {p.colaborador === "falhou"
                            ? `${p.nome} não foi adicionado ao repositório.`
                            : `${p.nome} ainda não aceitou o convite do repositório.`}
                        </span>
                        {souCriador && <TentarDeNovo jamId={jam.id} amigoId={p.id} nome={p.nome} />}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
