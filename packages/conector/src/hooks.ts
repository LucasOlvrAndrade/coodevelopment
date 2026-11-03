import { MOTIVOS_DE_PARADA, type MensagemStatus, type MotivoDeParada } from "@coodevelopment/protocolo";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

// Servidor local dos hooks do Claude Code (Story 4.1, components.md): só em
// 127.0.0.1, porta aleatória e segredo por sessão do conector, os dois no
// arquivo de descoberta da pasta. O hook manda o evento e o conector decide o
// status do Claude desta pasta.

const CORPO_MAXIMO = 16 * 1024;

const motivo = (erro: unknown): MotivoDeParada =>
  typeof erro === "string" && (MOTIVOS_DE_PARADA as readonly string[]).includes(erro) ? (erro as MotivoDeParada) : "unknown";

// Sem nenhum evento por esse tempo, a sessão conta como parada: o Stop não
// vem quando a pessoa interrompe com Esc nem quando a janela é fechada à
// força (gate da 4.1, REL-001). O fim de cada ferramenta renova.
export const SESSAO_VALE_MS = 10 * 60 * 1000;

const TERMINA = new Set(["Stop", "StopFailure", "SessionEnd", "Notification"]);

// O Claude da pasta trabalha enquanto alguma sessão dele estiver no meio de
// um prompt (pode haver mais de um Claude Code aberto na mesma pasta). O
// status muda só quando a primeira começa ou a última termina. Notification
// chega só com o Claude ocioso, esperando a pessoa (matcher idle_prompt).
export class StatusDoClaude {
  // Sessão → último evento dela.
  private sessoes = new Map<string, number>();

  constructor(
    private aoMudar: (m: MensagemStatus) => void,
    private agora: () => number = Date.now,
  ) {}

  get trabalhando(): boolean {
    return this.sessoes.size > 0;
  }

  evento(nome: string, corpo: { session_id?: unknown; error?: unknown }): void {
    const sessao = typeof corpo.session_id === "string" ? corpo.session_id : null;
    if (!sessao) return;
    const antes = this.trabalhando;
    if (nome === "UserPromptSubmit") this.sessoes.set(sessao, this.agora());
    // Só renova: um PostToolUse em segundo plano que chega depois do Stop não
    // liga o status de novo (gate da 4.1, REL-008).
    else if (nome === "PostToolUse") {
      if (this.sessoes.has(sessao)) this.sessoes.set(sessao, this.agora());
    }
    else if (TERMINA.has(nome)) this.sessoes.delete(sessao);
    else return;
    this.avisar(antes, nome === "StopFailure" ? motivo(corpo.error) : null);
  }

  // Tira as sessões sem evento há mais que a validade; o conector chama de
  // tempos em tempos.
  vencer(): void {
    const antes = this.trabalhando;
    const limite = this.agora() - SESSAO_VALE_MS;
    for (const [sessao, ultimo] of this.sessoes) if (ultimo < limite) this.sessoes.delete(sessao);
    this.avisar(antes, null);
  }

  private avisar(antes: boolean, motivoDaParada: MotivoDeParada | null) {
    if (!antes && this.trabalhando) this.aoMudar({ v: 1, tipo: "status", estado: "trabalhando", motivo: null });
    else if (antes && !this.trabalhando) this.aoMudar({ v: 1, tipo: "status", estado: "parado", motivo: motivoDaParada });
  }
}

export type ServidorDeHooks = { porta: number; segredo: string; fechar(): Promise<void> };

function segredoConfere(cabecalho: string | undefined, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const veio = Buffer.from(cabecalho ?? "");
  return veio.length === esperado.length && timingSafeEqual(veio, esperado);
}

export async function abrirServidorDeHooks(aoEvento: (nome: string, corpo: Record<string, unknown>) => void): Promise<ServidorDeHooks> {
  const segredo = randomBytes(32).toString("hex");
  const servidor = createServer((req, res) => {
    const caminho = /^\/hook\/([A-Za-z]+)$/.exec(req.url ?? "");
    // Sem o segredo, nem o corpo é lido: uma página da internet que tente
    // falar com 127.0.0.1 não sabe o segredo.
    if (req.method !== "POST" || !caminho || !segredoConfere(req.headers.authorization, segredo)) {
      res.statusCode = 404;
      res.end();
      req.resume();
      return;
    }
    let texto = "";
    let grande = false;
    req.setEncoding("utf8");
    req.on("data", (d: string) => {
      texto += d;
      if (texto.length > CORPO_MAXIMO) {
        grande = true;
        req.destroy();
      }
    });
    req.on("end", () => {
      // O hook não espera o processamento: responde na hora.
      res.statusCode = 204;
      res.end();
      if (grande) return;
      try {
        const corpo = JSON.parse(texto) as unknown;
        if (corpo && typeof corpo === "object") aoEvento(caminho[1]!, corpo as Record<string, unknown>);
      } catch {
        // Corpo estranho: ignora.
      }
    });
  });
  await new Promise<void>((resolver, rejeitar) => {
    servidor.once("error", rejeitar);
    servidor.listen(0, "127.0.0.1", () => resolver());
  });
  const porta = (servidor.address() as { port: number }).port;
  return {
    porta,
    segredo,
    fechar: () => new Promise<void>((r) => servidor.close(() => r())),
  };
}
