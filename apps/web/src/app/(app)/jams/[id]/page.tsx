import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChamarMaisAmigos } from "@/componentes/jams/ChamarMaisAmigos";
import { ExcluirJam } from "@/componentes/jams/ExcluirJam";
import { ParticipantesDaJam } from "@/componentes/jams/ParticipantesDaJam";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { listarAmigos } from "@/servidor/dominio/amizade";
import { obterJam } from "@/servidor/dominio/jam";

export const metadata: Metadata = { title: "Jam · Coodevelopment" };

const MAXIMO_NA_JAM = 3;

// Página da jam (Story 2.4): repositório, quem está nela e, para o criador,
// chamar mais amigos, tentar de novo e excluir. Só para participantes (AC 3).
// A presença ao vivo chega na Story 2.5 (sala na Cloudflare).
export async function ConteudoDaJam({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, eu] = await Promise.all([params, exigirSessao()]);
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
      <header className="flex flex-col gap-2">
        <Link href="/inicio" className="text-pequeno text-texto-suave hover:text-texto">
          ← Jams
        </Link>
        <h1 className="font-mono text-h1 font-semibold break-all">{repositorio}</h1>
        <p className="text-texto-suave">
          {aberta ? "Aberta" : jam.estado === "fechando" ? "Fechando" : "Fechada"} · branch {jam.branch} · código {jam.id}
        </p>
        <p>
          <a href={`https://github.com/${repositorio}`} className="font-medium text-destaque underline underline-offset-2">
            Abrir o repositório no GitHub
          </a>
        </p>
      </header>

      <section aria-labelledby="titulo-quem" className="flex flex-col gap-3">
        <h2 id="titulo-quem" className="text-h2 font-semibold">
          Quem está na jam
        </h2>
        <ParticipantesDaJam jam={jam} eu={eu.id} />
        {souCriador && aberta && vagas > 0 && <ChamarMaisAmigos jamId={jam.id} amigos={amigosForaDaJam} vagas={vagas} />}
        {souCriador && vagas <= 0 && <p className="text-pequeno text-texto-suave">A jam está completa: até 3 pessoas por enquanto.</p>}
      </section>

      <section aria-labelledby="titulo-claude" className="flex flex-col gap-2">
        <h2 id="titulo-claude" className="text-h2 font-semibold">
          Trabalhar junto
        </h2>
        <p className="text-texto-suave">
          Na próxima etapa, cada um liga o próprio Claude Code a esta jam com um comando no terminal, usando o código{" "}
          <span className="font-mono text-texto">{jam.id}</span>. Aí os arquivos ficam em sincronia e todo mundo vê o que cada Claude
          está fazendo. Por enquanto, a jam guarda o repositório e quem está nela.
        </p>
      </section>

      {souCriador && (
        <section aria-labelledby="titulo-gerenciar" className="flex flex-col items-start gap-2 border-t border-divisoria pt-6">
          <h2 id="titulo-gerenciar" className="text-h3 font-semibold">
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
    <div className="flex max-w-3xl flex-col gap-8">
      <Suspense fallback={<p className="text-texto-suave">Abrindo a jam...</p>}>
        <ConteudoDaJam params={params} />
      </Suspense>
    </div>
  );
}
