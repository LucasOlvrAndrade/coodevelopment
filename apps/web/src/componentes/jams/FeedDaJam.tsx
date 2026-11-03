"use client";

import type { ArquivoNoFeed, EventoFeed } from "@coodevelopment/protocolo";
import { useEffect, useState } from "react";
import { Avatar } from "@/componentes/ui/Avatar";
import { painel } from "@/componentes/ui/estilo";
import { COR_DA_VAGA } from "./ParticipantesDaJam";
import { useFeed } from "./PresencaDaJam";

export type PessoaDoFeed = { id: string; nome: string; foto: string | null; vaga: number };

// Hora relativa curta: "agora", "há 5 min", "há 2 h"; mais de um dia, a data.
export function quando(iso: string, agora: number): string {
  const segundos = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000));
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `há ${Math.floor(segundos / 3600)} h`;
  return new Date(iso).toLocaleString("pt-BR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function megabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

// O resumo da diferença de um arquivo (AC 1): o que se vê e o que o leitor de
// tela lê.
function resumoDoArquivo(a: ArquivoNoFeed): { visivel: string; lido: string } {
  if (a.mudanca === "apagado") return { visivel: "apagado", lido: "apagado" };
  const tipo = a.mudanca === "criado" ? "novo" : "alterado";
  if (a.binario) return { visivel: `${tipo}, binário`, lido: `${tipo}, arquivo binário` };
  if (a.adicionadas === null || a.removidas === null) return { visivel: tipo, lido: tipo };
  if (a.mudanca === "criado") return { visivel: `novo, +${a.adicionadas}`, lido: `novo, ${plural(a.adicionadas, "linha", "linhas")}` };
  return {
    visivel: `+${a.adicionadas} −${a.removidas}`,
    lido: `${plural(a.adicionadas, "linha acrescentada", "linhas acrescentadas")}, ${plural(a.removidas, "tirada", "tiradas")}`,
  };
}

const maiuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

// Nome de quem fez, ou "você"; no começo da frase, com maiúscula.
type Nomear = (id: string) => string;

// Frase curta do item, para o anúncio ao vivo e o título do item.
export function fraseDoEvento(e: EventoFeed, nome: Nomear): string {
  switch (e.tipo) {
    case "arquivos":
      return `${maiuscula(nome(e.autorId))} mudou ${plural(e.arquivos.length + e.outros, "arquivo", "arquivos")}`;
    case "dependencias":
      return `${maiuscula(nome(e.autorId))} mudou as dependências`;
    case "conflito":
      return `Conflito em ${e.caminho}`;
    case "grande":
      return `${e.caminho} ficou fora da jam`;
  }
}

// Quem perdeu o quê num conflito, do ponto de vista de quem lê (A2).
function textoDoConflito(e: Extract<EventoFeed, { tipo: "conflito" }>, nome: Nomear, eu: string): string {
  const autor = nome(e.autorId);
  const outro = nome(e.outroId);
  if (e.resolvido === "guardado") {
    if (e.autorId === eu) return `A sua mudança cruzou com uma de ${outro} e ficou guardada no histórico da jam; o arquivo ficou como ${outro} deixou.`;
    if (e.outroId === eu) return `A mudança de ${autor} cruzou com a sua e ficou guardada no histórico da jam; o arquivo ficou com a sua.`;
    return `A mudança de ${autor} cruzou com a de ${outro} e ficou guardada no histórico da jam; o arquivo ficou com a de ${outro}.`;
  }
  if (e.outroId === eu) return `${maiuscula(autor)} substituiu o arquivo binário; a sua versão anterior está guardada no histórico da jam.`;
  return `${maiuscula(autor)} substituiu o arquivo binário; a versão anterior, de ${outro}, está guardada no histórico da jam.`;
}

function Caminho({ children }: { children: string }) {
  return <code className="font-mono text-pequeno break-all text-texto">{children}</code>;
}

function Detalhe({ e, nome, eu }: { e: EventoFeed; nome: Nomear; eu: string }) {
  switch (e.tipo) {
    case "arquivos":
      return (
        <>
          <ul className="flex flex-col gap-1.5">
            {e.arquivos.map((a) => {
              const r = resumoDoArquivo(a);
              return (
                <li key={a.caminho} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <Caminho>{a.caminho}</Caminho>
                  <span className="shrink-0 text-pequeno text-texto-suave">
                    <span aria-hidden>{r.visivel}</span>
                    <span className="sr-only">{r.lido}</span>
                    {a.juntado && ", juntado com outra mudança"}
                  </span>
                </li>
              );
            })}
          </ul>
          {e.outros > 0 && <p className="text-pequeno text-texto-suave">e mais {plural(e.outros, "arquivo", "arquivos")}</p>}
        </>
      );
    case "dependencias":
      return (
        <>
          <ul className="flex flex-col gap-1">
            {e.caminhos.map((c) => (
              <li key={c}>
                <Caminho>{c}</Caminho>
              </li>
            ))}
          </ul>
          <p className="font-medium text-alerta">
            {e.autorId === eu ? "Quem está na jam vai precisar reinstalar as dependências." : "Reinstale as dependências no seu PC."}
          </p>
        </>
      );
    case "conflito":
      return (
        <>
          <Caminho>{e.caminho}</Caminho>
          <p className="text-texto-suave">{textoDoConflito(e, nome, eu)}</p>
        </>
      );
    case "grande":
      return (
        <p className="text-texto-suave">
          {e.autorId === eu ? "Arquivo seu" : `Arquivo de ${nome(e.autorId)}`} com {megabytes(e.tamanho)}; o limite da jam é 1 MB.
        </p>
      );
  }
}

// Destaque do que pede ação: dependências e trabalho no histórico (AC 2).
const DESTAQUE: Record<EventoFeed["tipo"], string> = {
  arquivos: "",
  dependencias: "ring-1 ring-alerta/60 bg-alerta/5",
  conflito: "ring-1 ring-erro/50 bg-erro/5",
  grande: "",
};

// Feed da jam (Story 3.4): o que mudou, quem mudou e o resumo, ao vivo pela
// sala, do mais novo ao mais antigo.
export function FeedDaJam({ pessoas, eu }: { pessoas: PessoaDoFeed[]; eu: string }) {
  const { eventos, carregado, novo } = useFeed();
  const [agora, setAgora] = useState(() => Date.now());

  // A hora relativa anda sozinha.
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const porId = new Map(pessoas.map((p) => [p.id, p]));
  const nome: Nomear = (id) => (id === eu ? "você" : (porId.get(id)?.nome ?? "alguém que saiu da jam"));

  return (
    <section aria-labelledby="titulo-feed" className="flex flex-col gap-4">
      <h2 id="titulo-feed" className="font-instrument-serif text-h2 tracking-tight">
        O que mudou
      </h2>
      {/* Só o item que chega ao vivo é anunciado, não o feed inteiro ao abrir (AC 4). */}
      <p role="status" className="sr-only">
        {novo ? fraseDoEvento(novo, nome) : ""}
      </p>
      {!carregado ? (
        <p className="text-texto-suave">O feed aparece quando a sala da jam responder.</p>
      ) : eventos.length === 0 ? (
        <p className="text-texto-suave">Nada mudou ainda. Quando alguém mudar um arquivo na pasta da jam, aparece aqui.</p>
      ) : (
        <ol aria-label="Mudanças, da mais recente à mais antiga" className="flex flex-col gap-3">
          {eventos.map((e) => {
            const autor = porId.get(e.autorId);
            return (
              <li key={e.id} className={`${painel} flex gap-3 px-4 py-3 ${DESTAQUE[e.tipo]}`}>
                <span className={`mt-0.5 inline-flex size-6 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-fundo ${autor ? (COR_DA_VAGA[autor.vaga] ?? "") : "ring-divisoria"}`}>
                  <Avatar nome={autor?.nome ?? "?"} foto={autor?.foto} tamanho={24} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="min-w-0 font-medium break-words">{fraseDoEvento(e, nome)}</span>
                    <time dateTime={e.atualizadoEm} className="shrink-0 text-pequeno text-texto-suave">
                      {quando(e.atualizadoEm, agora)}
                    </time>
                  </p>
                  <Detalhe e={e} nome={nome} eu={eu} />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
