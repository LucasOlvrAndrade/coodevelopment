"use client";

import { eventoFeed, mensagemDaSala, type EventoFeed, type MensagemFeed, type MotivoDeParada } from "@coodevelopment/protocolo";
import PartySocket from "partysocket";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Presenca = { online: ReadonlySet<string>; conectados: ReadonlySet<string> };
const NINGUEM: Presenca = { online: new Set(), conectados: new Set() };
const Online = createContext<Presenca>(NINGUEM);

// Feed da jam (Story 3.4): do mais novo ao mais antigo. "carregado" depois
// que a sala mandou o feed guardado; "novo" é o último item que chegou ao
// vivo, para o anúncio do leitor de tela.
export type EstadoFeed = { eventos: EventoFeed[]; carregado: boolean; novo: EventoFeed | null };
const SEM_FEED: EstadoFeed = { eventos: [], carregado: false, novo: null };
const Feed = createContext<EstadoFeed>(SEM_FEED);

// Status do Claude de cada participante (Story 4.1): quem está trabalhando,
// desde quando, e quem parou por erro há pouco (com o motivo).
// O resumo é o do aviso ativo (Story 4.2), ou null antes de o Claude anunciar.
export type Trabalhando = { desde: string; resumo: string | null };
export type EstadoClaudes = { trabalhando: ReadonlyMap<string, Trabalhando>; parou: ReadonlyMap<string, MotivoDeParada> };
const NENHUM_CLAUDE: EstadoClaudes = { trabalhando: new Map(), parou: new Map() };
const Claudes = createContext<EstadoClaudes>(NENHUM_CLAUDE);

// Quanto tempo o "parou: ..." fica na tela (front-end spec, fluxo do status).
export const PAROU_POR_MS = 8000;

// Itens guardados na memória da aba.
const ITENS_NA_PAGINA = 200;

// Mais recente em cima pela última mudança: um grupo que cresceu sobe acima
// de um item mais novo do mesmo autor (gate da 3.4, UX-001).
const maisRecente = (a: EventoFeed, b: EventoFeed) => b.atualizadoEm.localeCompare(a.atualizadoEm) || b.id - a.id;

// O feed guardado substitui tudo (também ao reconectar); o item ao vivo
// entra no lugar do de mesmo id (grupo atualizado) ou como novo.
export function aplicarFeed(atual: EstadoFeed, msg: MensagemFeed): EstadoFeed {
  if (msg.inicial) return { eventos: [...msg.eventos].sort(maisRecente).slice(0, ITENS_NA_PAGINA), carregado: true, novo: null };
  const chegaram = new Set(msg.eventos.map((e) => e.id));
  const eventos = [...msg.eventos, ...atual.eventos.filter((e) => !chegaram.has(e.id))].sort(maisRecente).slice(0, ITENS_NA_PAGINA);
  return { eventos, carregado: atual.carregado, novo: msg.eventos.at(-1) ?? atual.novo };
}

// A mensagem do feed lida item por item: um tipo que esta versão da página
// não conhece (os avisos do Epic 4, numa aba aberta antes da atualização)
// fica de fora sem levar o resto (gate da 3.4, REL-002).
export function lerFeed(dados: unknown): MensagemFeed | null {
  if (typeof dados !== "object" || dados === null) return null;
  const { tipo, inicial, eventos } = dados as { tipo?: unknown; inicial?: unknown; eventos?: unknown };
  if (tipo !== "feed" || typeof inicial !== "boolean" || !Array.isArray(eventos)) return null;
  return {
    v: 1,
    tipo: "feed",
    inicial,
    eventos: eventos.flatMap((e) => {
      const lido = eventoFeed.safeParse(e);
      return lido.success ? [lido.data] : [];
    }),
  };
}

class ErroDoToken extends Error {
  constructor(public status: number) {
    super(`token-sala ${status}`);
  }
}

async function pedirToken(jamId: string): Promise<{ token: string; salaUrl: string }> {
  const resposta = await fetch(`/api/jams/${encodeURIComponent(jamId)}/token-sala`, { method: "POST", cache: "no-store" });
  if (!resposta.ok) throw new ErroDoToken(resposta.status);
  return resposta.json();
}

function lerJson(dados: unknown): unknown {
  try {
    return JSON.parse(String(dados));
  } catch {
    return null;
  }
}

// Presença ao vivo na página da jam (Story 2.5): pede o token da sala, conecta
// pelo partysocket (token novo a cada reconexão) e guarda quem está com a
// página aberta agora e quem está com o conector ligado (Story 3.1). Sem sala (503, rede fora, token recusado) o conjunto
// ficam vazios e a página segue igual (AC 4). O token fica só na memória da aba.
export function PresencaDaJam({ jamId, children }: { jamId: string; children: ReactNode }) {
  const [presenca, setPresenca] = useState<Presenca>(NINGUEM);
  const [feed, setFeed] = useState<EstadoFeed>(SEM_FEED);
  const [claudes, setClaudes] = useState<EstadoClaudes>(NENHUM_CLAUDE);

  useEffect(() => {
    let ativo = true;
    const timersDoParou = new Map<string, ReturnType<typeof setTimeout>>();
    let socket: PartySocket | undefined;
    pedirToken(jamId)
      .then(({ token, salaUrl }) => {
        if (!ativo) return;
        const url = new URL(salaUrl);
        // O primeiro token serve à primeira conexão; cada reconexão pede outro.
        let primeiro: string | undefined = token;
        socket = new PartySocket({
          host: url.host,
          protocol: url.protocol === "ws:" ? "ws" : "wss",
          party: "jam",
          room: jamId,
          // Rede fora ou sala sem resposta: o partysocket tenta de novo, com
          // espera crescente. Sessão vencida (401) ou fora da jam (403) não se
          // resolvem tentando: a conexão fecha (gate da 2.5, REL-001).
          query: async () => {
            try {
              const atual = primeiro ?? (await pedirToken(jamId)).token;
              primeiro = undefined;
              return { token: atual };
            } catch (e) {
              if (e instanceof ErroDoToken && (e.status === 401 || e.status === 403)) socket?.close();
              throw e;
            }
          },
        });
        socket.addEventListener("message", (evento) => {
          const dados = lerJson(evento.data);
          const feed = lerFeed(dados);
          if (feed) {
            setFeed((atual) => aplicarFeed(atual, feed));
            return;
          }
          const lido = mensagemDaSala.safeParse(dados);
          if (!lido.success) return;
          const msg = lido.data;
          if (msg.tipo === "presenca") setPresenca({ online: new Set(msg.online), conectados: new Set(msg.conectados) });
          else if (msg.tipo === "claudes") {
            const trabalhando = new Map(msg.trabalhando.map((c) => [c.usuarioId, { desde: c.desde, resumo: c.resumo ?? null }]));
            // Quem voltou a trabalhar não continua "parado".
            setClaudes((atual) => ({ trabalhando, parou: new Map([...atual.parou].filter(([id]) => !trabalhando.has(id))) }));
          } else if (msg.tipo === "parou") {
            const { usuarioId, motivo } = msg;
            setClaudes((atual) => ({ ...atual, parou: new Map(atual.parou).set(usuarioId, motivo) }));
            // Um timer por pessoa: um "parou" novo recomeça a contagem
            // (gate da 4.1, UX-002).
            clearTimeout(timersDoParou.get(usuarioId));
            timersDoParou.set(
              usuarioId,
              setTimeout(() => {
                timersDoParou.delete(usuarioId);
                setClaudes((atual) => {
                  if (!atual.parou.has(usuarioId)) return atual;
                  const parou = new Map(atual.parou);
                  parou.delete(usuarioId);
                  return { ...atual, parou };
                });
              }, PAROU_POR_MS),
            );
          }
        });
        socket.addEventListener("close", (evento) => {
          setPresenca(NINGUEM);
          setClaudes(NENHUM_CLAUDE);
          // Token recusado pela própria sala: tentar de novo não resolve.
          if (evento.code === 4401) socket?.close();
        });
      })
      .catch(() => {});
    return () => {
      ativo = false;
      socket?.close();
      for (const t of timersDoParou.values()) clearTimeout(t);
    };
  }, [jamId]);

  return (
    <Online.Provider value={presenca}>
      <Claudes.Provider value={claudes}>
        <Feed.Provider value={feed}>{children}</Feed.Provider>
      </Claudes.Provider>
    </Online.Provider>
  );
}

// "online agora" ao lado de quem está com a página da jam aberta.
export function MarcaOnline({ usuarioId }: { usuarioId: string }) {
  if (!useContext(Online).online.has(usuarioId)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-pequeno font-normal text-sucesso">
      <span aria-hidden className="size-2 rounded-full bg-sucesso" />
      online agora
    </span>
  );
}

// "conectado" ao lado de quem está com o conector ligado (Story 3.1, AC 3).
export function MarcaConectado({ usuarioId }: { usuarioId: string }) {
  if (!useContext(Online).conectados.has(usuarioId)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 text-pequeno font-normal text-texto ring-1 ring-texto/15">
      <span aria-hidden className="font-mono">&gt;_</span>
      conectado
    </span>
  );
}

// A pessoa está com o conector ligado agora? (passo de conexão, Story 3.2)
export function useConectado(usuarioId: string): boolean {
  return useContext(Online).conectados.has(usuarioId);
}

// O feed da jam ao vivo (Story 3.4).
export function useFeed(): EstadoFeed {
  return useContext(Feed);
}

// O Claude de cada participante, ao vivo (Story 4.1).
export function useClaudes(): EstadoClaudes {
  return useContext(Claudes);
}
