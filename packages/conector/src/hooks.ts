import {
  ARQUIVOS_DO_AVISO,
  MOTIVOS_DE_PARADA,
  RESUMO_MAXIMO,
  normalizarCaminho,
  type MensagemAviso,
  type MensagemStatus,
  type MotivoDeParada,
} from "@coodevelopment/protocolo";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { isAbsolute, relative, resolve } from "node:path";

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

// O nome da ferramenta como o Claude a vê (plugin coodevelopment, servidor coodevelopment).
export const FERRAMENTA_ANUNCIAR = "mcp__plugin_coodevelopment_coodevelopment__anunciar";

export const MOTIVO_SEM_AVISO = `Esta pasta está numa jam do Coodevelopment, com outras pessoas trabalhando junto. Antes de editar, chame a ferramenta ${FERRAMENTA_ANUNCIAR} com um resumo curto do que vai fazer e os arquivos; depois tente a edição de novo.`;

// O Claude da pasta trabalha enquanto alguma sessão dele estiver no meio de
// um prompt (pode haver mais de um Claude Code aberto na mesma pasta). O
// status muda só quando a primeira começa ou a última termina. Notification
// chega só com o Claude ocioso, esperando a pessoa (matcher idle_prompt).
export class StatusDoClaude {
  // Sessão → último evento dela.
  private sessoes = new Map<string, number>();
  // O aviso ativo da pasta (Story 4.2): vale até o Claude terminar.
  private aviso: { resumo: string; arquivos: string[]; em: number } | null = null;

  constructor(
    private aoMudar: (m: MensagemStatus | MensagemAviso) => void,
    private agora: () => number = Date.now,
    private pasta = process.cwd(),
  ) {}

  get avisoAtivo(): boolean {
    return this.aviso !== null;
  }

  // O aviso ativo como mensagem para a sala (para reenviar ao reconectar).
  get avisoAtual(): MensagemAviso | null {
    return this.aviso ? { v: 1, tipo: "aviso", resumo: this.aviso.resumo, arquivos: this.aviso.arquivos } : null;
  }

  // O Claude anunciou (FR13): resumo até 300 caracteres, até 50 arquivos,
  // caminhos relativos à pasta (o que fica fora dela não entra).
  anunciar(resumo: string, arquivos: string[]): MensagemAviso {
    const relativos = arquivos
      .map((a) => {
        const r = relative(this.pasta, resolve(this.pasta, a));
        return r && !r.startsWith("..") && !isAbsolute(r) ? normalizarCaminho(r) : null;
      })
      .filter((a): a is string => Boolean(a));
    const mensagem: MensagemAviso = {
      v: 1,
      tipo: "aviso",
      resumo: resumo.trim().slice(0, RESUMO_MAXIMO),
      arquivos: [...new Set(relativos)].slice(0, ARQUIVOS_DO_AVISO),
    };
    this.aviso = { resumo: mensagem.resumo, arquivos: mensagem.arquivos, em: this.agora() };
    this.aoMudar(mensagem);
    return mensagem;
  }

  // Edição pelas ferramentas do Claude (PreToolUse): sem aviso ativo, recusa
  // com o motivo (FR14). Arquivo fora da pasta da jam não é da jam: segue.
  decidirEdicao(corpo: { file_path?: unknown }): { decisao: "recusar"; motivo: string } | null {
    if (this.aviso) return null;
    if (typeof corpo.file_path === "string") {
      const r = relative(this.pasta, resolve(this.pasta, corpo.file_path));
      if (r.startsWith("..") || isAbsolute(r)) return null;
    }
    return { decisao: "recusar", motivo: MOTIVO_SEM_AVISO };
  }

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
  // tempos em tempos. Um aviso sem sessão nenhuma também vence.
  vencer(): void {
    const antes = this.trabalhando;
    const limite = this.agora() - SESSAO_VALE_MS;
    for (const [sessao, ultimo] of this.sessoes) if (ultimo < limite) this.sessoes.delete(sessao);
    if (!this.trabalhando && this.aviso && this.aviso.em < limite) this.aviso = null;
    this.avisar(antes, null);
  }

  private avisar(antes: boolean, motivoDaParada: MotivoDeParada | null) {
    if (!antes && this.trabalhando) this.aoMudar({ v: 1, tipo: "status", estado: "trabalhando", motivo: null });
    else if (antes && !this.trabalhando) {
      // O aviso termina quando o Claude termina (Story 4.2, AC 6); a sala faz o mesmo.
      this.aviso = null;
      this.aoMudar({ v: 1, tipo: "status", estado: "parado", motivo: motivoDaParada });
    }
  }
}

export type ServidorDeHooks = { porta: number; segredo: string; fechar(): Promise<void> };

function segredoConfere(cabecalho: string | undefined, segredo: string): boolean {
  const esperado = Buffer.from(`Bearer ${segredo}`);
  const veio = Buffer.from(cabecalho ?? "");
  return veio.length === esperado.length && timingSafeEqual(veio, esperado);
}

// O que o servidor faz com cada pedido. A resposta do evento (a recusa do
// PreToolUse) volta ao hook; sem resposta, 204.
export type TratarHooks = {
  aoEvento(nome: string, corpo: Record<string, unknown>): unknown;
  aoAnunciar?(corpo: Record<string, unknown>): { status: number; corpo: unknown };
};

function responderJson(res: ServerResponse, status: number, corpo: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(corpo));
}

export async function abrirServidorDeHooks(tratar: TratarHooks | TratarHooks["aoEvento"]): Promise<ServidorDeHooks> {
  const { aoEvento, aoAnunciar } = typeof tratar === "function" ? { aoEvento: tratar, aoAnunciar: undefined } : tratar;
  const segredo = randomBytes(32).toString("hex");
  const servidor = createServer((req, res) => {
    // /hook/{evento} dos hooks e /mcp/anunciar do servidor MCP (Story 4.2).
    const caminho = /^\/(?:hook\/([A-Za-z]+)|mcp\/(anunciar))$/.exec(req.url ?? "");
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
      let corpo: Record<string, unknown> | null = null;
      try {
        const lido = grande ? null : (JSON.parse(texto) as unknown);
        if (lido && typeof lido === "object" && !Array.isArray(lido)) corpo = lido as Record<string, unknown>;
      } catch {
        // Corpo estranho: ignora.
      }
      if (caminho[2]) {
        const r = corpo && aoAnunciar ? aoAnunciar(corpo) : { status: 400, corpo: { mensagem: "Pedido inválido." } };
        responderJson(res, r.status, r.corpo);
        return;
      }
      const resposta = corpo ? aoEvento(caminho[1]!, corpo) : undefined;
      if (resposta) responderJson(res, 200, resposta);
      else {
        res.statusCode = 204;
        res.end();
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
