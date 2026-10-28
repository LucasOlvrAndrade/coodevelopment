"use client";

import { mensagemDaSala } from "@coodevelopment/protocolo";
import PartySocket from "partysocket";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

const Online = createContext<ReadonlySet<string>>(new Set());

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
// página aberta agora. Sem sala (503, rede fora, token recusado) o conjunto
// fica vazio e a página segue igual (AC 4). O token fica só na memória da aba.
export function PresencaDaJam({ jamId, children }: { jamId: string; children: ReactNode }) {
  const [online, setOnline] = useState<ReadonlySet<string>>(() => new Set());

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
          if (lido.success && lido.data.tipo === "presenca") setOnline(new Set(lido.data.online));
        });
        socket.addEventListener("close", (evento) => {
          setOnline(new Set());
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

  return <Online.Provider value={online}>{children}</Online.Provider>;
}

// "online agora" ao lado de quem está com a página da jam aberta.
export function MarcaOnline({ usuarioId }: { usuarioId: string }) {
  if (!useContext(Online).has(usuarioId)) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-pequeno font-normal text-sucesso">
      <span aria-hidden className="size-2 rounded-full bg-sucesso" />
      online agora
    </span>
  );
}
