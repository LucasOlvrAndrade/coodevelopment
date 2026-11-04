"use client";

import type { ArquivoNoFeed, EventoFeed } from "@coodevelopment/protocolo";
import { useEffect, useState } from "react";
import { Avatar } from "@/componentes/ui/Avatar";
import { painel } from "@/componentes/ui/estilo";
import { COR_DA_VAGA } from "./ParticipantesDaJam";
import { useFeed } from "./PresencaDaJam";

export type PessoaDoFeed = { id: string; nome: string; foto: string | null; vaga: number };

// Hora relativa curta: "agora", "há 5 min", "há 2 h"; mais de um dia, nada
// (o dia e a hora já dizem).
export function quando(iso: string, agora: number): string | null {
  const segundos = Math.max(0, Math.round((agora - Date.parse(iso)) / 1000));
  if (segundos < 60) return "agora";
  if (segundos < 3600) return `há ${Math.floor(segundos / 60)} min`;
  if (segundos < 86_400) return `há ${Math.floor(segundos / 3600)} h`;
  return null;
}

// Dia e hora no fuso de quem lê: "04/11 às 14:32" (pedido do Lucas, 04/11).
export function diaEHora(iso: string, fuso?: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: fuso });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: fuso });
  return `${dia} às ${hora}`;
}

// O que aparece no item: dia e hora, e há quanto tempo quando é recente.
export function momento(iso: string, agora: number, fuso?: string): string {
  const relativo = quando(iso, agora);
  return relativo ? `${diaEHora(iso, fuso)} · ${relativo}` : diaEHora(iso, fuso);
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

// Quantos arquivos o item conta: acima de 50, "mais de 50", porque o
// excedente é contado por mudança, não por arquivo (gate da 3.4, DATA-001).
function quantos(e: { arquivos: unknown[]; outros: number }): string {
  return e.outros > 0 ? `mais de ${e.arquivos.length} arquivos` : plural(e.arquivos.length, "arquivo", "arquivos");
}

// O Claude de alguém: "Seu Claude Code" ou "Claude Code de Fulano" (D9).
const claudeDe = (id: string, nome: Nomear) => (nome(id) === "você" ? "Seu Claude Code" : `Claude Code de ${nome(id)}`);

// Frase curta do item, para o anúncio ao vivo e o título do item.
export function fraseDoEvento(e: EventoFeed, nome: Nomear): string {
  switch (e.tipo) {
    case "arquivos":
      return `${maiuscula(nome(e.autorId))} mudou ${quantos(e)}`;
    case "dependencias":
      return `${maiuscula(nome(e.autorId))} mudou as dependências`;
    case "aviso":
      // Quem anuncia é o Claude da pessoa (D9; gate da 4.2, UX-003).
      return `${claudeDe(e.autorId, nome)} anunciou: ${e.resumo}`;
    case "reserva":
      // Story 4.4 (FR16): o arquivo está no aviso de outro.
      return `${claudeDe(e.autorId, nome)} pediu para mexer em ${e.caminho}, que ${nome(e.donoId) === "você" ? "o seu" : `o de ${nome(e.donoId)}`} anunciou`;
    case "conflito":
      return `Conflito em ${e.caminho}`;
    case "grande":
      return e.arquivos.length === 1 && e.outros === 0 ? `${e.arquivos[0]!.caminho} ficou fora da jam` : `${maiuscula(quantos(e))} ficaram fora da jam`;
  }
}

// Quem perdeu o quê num conflito, do ponto de vista de quem lê (A2). A
// mesma pessoa dos dois lados é ela com duas pastas na jam (gate da 3.4,
// DATA-003).
function textoDoConflito(e: Extract<EventoFeed, { tipo: "conflito" }>, nome: Nomear, eu: string): string {
  const autor = nome(e.autorId);
  const outro = nome(e.outroId);
  const pastas = `Duas pastas ${e.autorId === eu ? "suas" : `de ${autor}`}`;
  if (e.resolvido === "guardado") {
    if (e.autorId === e.outroId) return `${pastas} mudaram o mesmo trecho; a mudança que chegou depois ficou guardada no histórico da jam.`;
    if (e.autorId === eu) return `A sua mudança cruzou com uma de ${outro} e ficou guardada no histórico da jam; o arquivo ficou como ${outro} deixou.`;
    if (e.outroId === eu) return `A mudança de ${autor} cruzou com a sua e ficou guardada no histórico da jam; o arquivo ficou com a sua.`;
    return `A mudança de ${autor} cruzou com a de ${outro} e ficou guardada no histórico da jam; o arquivo ficou com a de ${outro}.`;
  }
  // Também acontece com uma pasta só, quando o conector manda de novo uma
  // escrita (gate da 3.4, DATA-004): o texto não supõe duas pastas.
  if (e.autorId === e.outroId) return `Duas versões ${e.autorId === eu ? "suas" : `de ${autor}`} do arquivo se cruzaram; a anterior está guardada no histórico da jam.`;
  if (e.outroId === eu) return `${maiuscula(autor)} substituiu o arquivo; a sua versão anterior está guardada no histórico da jam.`;
  return `${maiuscula(autor)} substituiu o arquivo; a versão anterior, de ${outro}, está guardada no histórico da jam.`;
}

// O caminho isolado do texto em volta (bdi): um nome em árabe ou hebraico não
// embaralha o resumo ao lado.
function Caminho({ children }: { children: string }) {
  return (
    <code className="font-mono text-pequeno break-all text-texto">
      <bdi>{children}</bdi>
    </code>
  );
}

// Os arquivos de um item, com o resumo de cada um (AC 1).
function ListaDeArquivos({ arquivos, outros }: { arquivos: ArquivoNoFeed[]; outros: number }) {
  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {arquivos.map((a) => {
          const r = resumoDoArquivo(a);
          return (
            <li key={a.caminho} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <Caminho>{a.caminho}</Caminho>
              <span className="shrink-0 text-pequeno text-texto-suave">
                <span aria-hidden>{r.visivel}</span>
                <span className="sr-only">{r.lido}</span>
                {a.juntado && ", juntado com outra mudança"}
                {/* Veio sem aviso do Claude: terminal, edição à mão (Story 4.2, FR19). */}
                {a.semAviso && (
                  <>
                    <span className="sr-only">, </span>
                    <span className="ml-2 rounded-full px-1.5 text-alerta ring-1 ring-alerta/50">sem aviso</span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      {outros > 0 && <p className="text-pequeno text-texto-suave">e mais {plural(outros, "mudança", "mudanças")} em arquivos que não cabem aqui</p>}
    </>
  );
}

function Detalhe({ e, nome, eu }: { e: EventoFeed; nome: Nomear; eu: string }) {
  switch (e.tipo) {
    case "arquivos":
      return <ListaDeArquivos arquivos={e.arquivos} outros={e.outros} />;
    case "dependencias":
      return (
        <>
          <ListaDeArquivos arquivos={e.arquivos} outros={e.outros} />
          <p className="font-medium text-alerta">
            {e.autorId === eu ? "Quem está na jam vai precisar reinstalar as dependências." : "Reinstale as dependências no seu PC."}
          </p>
        </>
      );
    case "aviso":
      return e.arquivos.length ? (
        <ul aria-label="Arquivos que ele vai mexer" className="flex flex-wrap gap-1.5">
          {e.arquivos.map((c) => (
            <li key={c} className="rounded-full bg-texto/5 px-2 py-0.5 ring-1 ring-divisoria">
              <Caminho>{c}</Caminho>
            </li>
          ))}
        </ul>
      ) : null;
    case "reserva":
      return (
        <>
          <Caminho>{e.caminho}</Caminho>
          <p className="text-texto-suave">
            {/* Sem estado: o item não sabe se a pessoa confirmou (gate da 4.4, UX-002). */}
            Aviso {e.donoId === eu ? "do seu Claude Code" : `do Claude Code de ${nome(e.donoId)}`}: “{e.resumo}”. O Claude Code perguntou{" "}
            {e.autorId === eu ? "a você" : `a ${nome(e.autorId)}`} antes de editar.
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
        <>
          <ul className="flex flex-col gap-1.5">
            {e.arquivos.map((a) => (
              <li key={a.caminho} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <Caminho>{a.caminho}</Caminho>
                <span className="shrink-0 text-pequeno text-texto-suave">{megabytes(a.tamanho)}</span>
              </li>
            ))}
          </ul>
          {e.outros > 0 && <p className="text-pequeno text-texto-suave">e mais {plural(e.outros, "aviso", "avisos")} de arquivos que não cabem aqui</p>}
          {/* Singular com um arquivo só (gate da 3.4, UX-003). */}
          <p className="text-texto-suave">
            {e.arquivos.length === 1 && e.outros === 0 ? "Ficou" : "Ficaram"} só {e.autorId === eu ? "no seu PC" : `no PC de ${nome(e.autorId)}`}: o limite da jam é 1 MB por arquivo.
          </p>
        </>
      );
  }
}

// Destaque do que pede ação: dependências e trabalho no histórico (AC 2).
const DESTAQUE: Record<EventoFeed["tipo"], string> = {
  arquivos: "",
  dependencias: "ring-1 ring-alerta/60 bg-alerta/5",
  conflito: "ring-1 ring-erro/50 bg-erro/5",
  grande: "",
  aviso: "ring-1 ring-sucesso/40",
  reserva: "ring-1 ring-alerta/60 bg-alerta/5",
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
                      {momento(e.atualizadoEm, agora)}
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
