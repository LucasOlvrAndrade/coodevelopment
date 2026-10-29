import { mensagemDaSala } from "@coodevelopment/protocolo";
import PartySocket from "partysocket";
import type { Ambiente } from "./ambiente";
import { tokenDaSala } from "./api";

// Conexão do conector com a sala da jam (Story 3.1, AC 3). Com ela aberta, a
// página da jam mostra o participante como "conectado". O token da sala vale
// 10 minutos; cada reconexão pede outro ao app.

export type ConexaoSala = { fechar(): void; fechou: Promise<string> };

function lerJson(dados: unknown): unknown {
  try {
    return JSON.parse(String(dados));
  } catch {
    return null;
  }
}

export async function conectarNaSala(amb: Ambiente, sessao: string, jamId: string, aoConectar: () => void): Promise<ConexaoSala> {
  const primeiro = await tokenDaSala(amb, sessao, jamId);
  const url = new URL(primeiro.salaUrl);
  let token: string | undefined = primeiro.token;
  let avisarFim: (motivo: string) => void = () => {};
  const fechou = new Promise<string>((r) => (avisarFim = r));

  const socket = new PartySocket({
    host: url.host,
    protocol: url.protocol === "ws:" ? "ws" : "wss",
    party: "jam",
    room: jamId,
    query: async () => {
      const atual = token ?? (await tokenDaSala(amb, sessao, jamId)).token;
      token = undefined;
      return { token: atual };
    },
  });

  let conectado = false;
  socket.addEventListener("open", () => {
    if (!conectado) aoConectar();
    else amb.escrever("Reconectado à jam.");
    conectado = true;
  });
  socket.addEventListener("message", (evento) => {
    // Por enquanto só a presença; os arquivos chegam na Story 3.3.
    mensagemDaSala.safeParse(lerJson(evento.data));
  });
  socket.addEventListener("close", (evento) => {
    // Token recusado pela sala: tentar de novo não resolve.
    if (evento.code === 4401) {
      socket.close();
      avisarFim("A sala recusou a entrada. Rode o comando de novo.");
    } else if (conectado) {
      amb.escrever("A conexão com a jam caiu. Tentando de novo...");
    }
  });

  return {
    fechar: () => {
      socket.close();
      avisarFim("");
    },
    fechou,
  };
}
