import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChamarMaisAmigos } from "@/componentes/jams/ChamarMaisAmigos";
import { ExcluirJam } from "@/componentes/jams/ExcluirJam";
import { ParticipantesDaJam } from "@/componentes/jams/ParticipantesDaJam";
import { PresencaDaJam } from "@/componentes/jams/PresencaDaJam";
import { ResultadoDaAcao } from "@/componentes/jams/ResultadoDaAcao";
import { link, painel, tituloPagina, tituloSecao } from "@/componentes/ui/estilo";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarAmigos } from "@/servidor/dominio/amizade";
import { idDeJamValido, obterJam } from "@/servidor/dominio/jam";
import { sincronizarComPrazo } from "@/servidor/sincronizar-pendentes";

export const metadata: Metadata = { title: "Jam · Coodevelopment" };

const MAXIMO_NA_JAM = 3;

// Página da jam (Story 2.4): repositório, quem está nela e, para o criador,
// chamar mais amigos, tentar de novo e excluir. Só para participantes (AC 3).
// Quem está com a página aberta aparece ao vivo pela sala (Story 2.5).
export async function ConteudoDaJam({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, eu] = await Promise.all([params, exigirSessao()]);
  // Id fora do formato nem vai ao banco (gate da 2.4, REL-001).
  if (!idDeJamValido(id)) notFound();
  // Quem aceitou o convite pelo link aparece como no repositório (gate da 2.4, REL-003).
  await sincronizarComPrazo(eu.id);
  const jam = await obterJam(db(), eu.id, id);
  if (!jam) notFound();

  const souCriador = jam.criadorId === eu.id;
  const aberta = jam.estado === "aberta";
  const vagas = MAXIMO_NA_JAM - jam.participantes.length;
  const amigosForaDaJam =
    souCriador && aberta && vagas > 0
      ? (await listarAmigos(db(), eu.id))
          .filter((a) => !jam.participantes.some((p) => p.id === a.id))
          .map(({ id: amigoId, login, nome, foto }) => ({ id: amigoId, login, nome, foto }))
      : [];
  const repositorio = `${jam.repoOwner}/${jam.repoNome}`;

  return (
    <>
      <header className="flex flex-col items-start gap-4">
        <Link
          href="/inicio"
          className="inline-flex items-center gap-2 rounded-full bg-texto/5 px-3 py-1.5 text-sm text-texto-suave ring-1 ring-divisoria transition-colors hover:text-texto"
        >
          ← Jams
        </Link>
        {/* O selo da página inicial: a situação no chip branco e o código ao lado. */}
        <p className="inline-flex max-w-full items-center gap-3 rounded-full bg-texto/10 px-2.5 py-2 ring-1 ring-texto/15 backdrop-blur">
          <span className="inline-flex shrink-0 items-center rounded-full bg-primaria/90 px-2 py-0.5 text-xs font-medium text-sobre-primaria">
            {aberta ? "Aberta" : jam.estado === "fechando" ? "Fechando" : "Fechada"}
          </span>
          <span className="sr-only">, </span>
          <span className="text-sm font-medium text-texto/90">código {jam.id}</span>
        </p>
        {/* Nome longo quebra no hífen ou na barra, não no meio da palavra (gate da 2.4, UX-003). */}
        <h1 className={`${tituloPagina} break-words`}>{repositorio}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-texto-suave">
          <span>
            branch <span className="font-mono text-texto">{jam.branch}</span>
          </span>
          <a href={`https://github.com/${repositorio}`} className={link}>
            Abrir o repositório no GitHub
          </a>
        </p>
      </header>

      <section aria-labelledby="titulo-quem" className="flex flex-col gap-4">
        <h2 id="titulo-quem" className={tituloSecao}>
          Quem está na jam
        </h2>
        <PresencaDaJam jamId={jam.id}>
          <ResultadoDaAcao>
            <ParticipantesDaJam jam={jam} eu={eu.id} />
            {souCriador && aberta && <ChamarMaisAmigos jamId={jam.id} amigos={amigosForaDaJam} vagas={vagas} />}
          </ResultadoDaAcao>
        </PresencaDaJam>
      </section>

      <section aria-labelledby="titulo-claude" className={`${painel} flex flex-col gap-3 p-6`}>
        <h2 id="titulo-claude" className={tituloSecao}>
          Trabalhar junto
        </h2>
        <p className="text-texto-suave">
          Na próxima etapa, cada um liga o próprio Claude Code a esta jam com um comando no terminal, usando o código{" "}
          <span className="font-mono text-texto">{jam.id}</span>. Aí os arquivos ficam em sincronia e todo mundo vê o que cada Claude
          está fazendo. Por enquanto, a jam guarda o repositório e quem está nela.
        </p>
      </section>

      {souCriador && (
        <section aria-labelledby="titulo-gerenciar" className="flex flex-col items-start gap-3 border-t border-divisoria pt-8">
          <h2 id="titulo-gerenciar" className="text-h3 font-medium">
            Gerenciar
          </h2>
          <ExcluirJam jamId={jam.id} repositorio={repositorio} />
        </section>
      )}
    </>
  );
}

export default function PaginaDaJam({ params }: PageProps<"/jams/[id]">) {
  return (
    <div className="flex max-w-3xl flex-col gap-10">
      <Suspense fallback={<p className="text-texto-suave">Abrindo a jam...</p>}>
        <ConteudoDaJam params={params} />
      </Suspense>
    </div>
  );
}
