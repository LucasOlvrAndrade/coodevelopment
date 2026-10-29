"use client";

import { mensagemDaSala } from "@coodevelopment/protocolo";
import PartySocket from "partysocket";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Presenca = { online: ReadonlySet<string>; conectados: ReadonlySet<string> };
const NINGUEM: Presenca = { online: new Set(), conectados: new Set() };
const Online = createContext<Presenca>(NINGUEM);

async function pedirToken(jamId: string): Promise<{ token: string; salaUrl: string }> {
  const resposta = await fetch(`/api/jams/${encodeURIComponent(jamId)}/token-sala`, { method: "POST", cache: "no-store" });
  if (!resposta.ok) throw new Error(`token-sala ${resposta.status}`);
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

  useEffect(() => {
    let ativo = true;
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
          query: async () => {
            const atual = primeiro ?? (await pedirToken(jamId)).token;
            primeiro = undefined;
            return { token: atual };
          },
        });
        socket.addEventListener("message", (evento) => {
          const lido = mensagemDaSala.safeParse(lerJson(evento.data));
          if (lido.success && lido.data.tipo === "presenca") {
            setPresenca({ online: new Set(lido.data.online), conectados: new Set(lido.data.conectados) });
          }
        });
        socket.addEventListener("close", (evento) => {
          setPresenca(NINGUEM);
          // Token recusado pela própria sala: tentar de novo não resolve.
          if (evento.code === 4401) socket?.close();
        });
      })
      .catch(() => {});
    return () => {
      ativo = false;
      socket?.close();
    };
  }, [jamId]);

  return <Online.Provider value={presenca}>{children}</Online.Provider>;
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
