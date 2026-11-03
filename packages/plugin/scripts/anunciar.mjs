// Lógica do servidor MCP do Coodevelopment (Story 4.2): a ferramenta
// `anunciar`, que o Claude chama antes de editar, e as respostas JSON-RPC.
// Passa o aviso ao conector da jam desta pasta; fora de uma jam, a
// ferramenta responde que pode seguir. A entrada é o mcp.mjs.
import { acharJam, pastaDados } from "./aviso.mjs";

const PRAZO_MS = 3000;
const VERSAO_PADRAO = "2025-06-18";

export const DESCRICAO = [
  "Anuncia aos outros participantes da jam do Coodevelopment o que você vai fazer agora e em quais arquivos, antes de editar.",
  "Chame antes de usar Edit, Write ou NotebookEdit: sem um anúncio ativo, a edição é recusada.",
  "Chame também antes de comandos de terminal que criam, mudam ou apagam arquivos (geradores, formatadores, instalação de pacotes, scripts), porque essas mudanças chegam aos outros e aparecem como 'sem aviso' se você não anunciar.",
  "O resumo vira o status que todos veem ('Claude Code de Fulano está trabalhando em: ...'): uma frase curta em português, sobre o que muda no projeto.",
  "Anuncie de novo se o plano mudar. O anúncio vale até você terminar a resposta.",
].join(" ");

export const FERRAMENTA = {
  name: "anunciar",
  description: DESCRICAO,
  inputSchema: {
    type: "object",
    properties: {
      resumo: { type: "string", maxLength: 300, description: "O que você vai fazer, numa frase curta (ex.: 'Login com Google na tela de entrada')." },
      arquivos: { type: "array", items: { type: "string" }, maxItems: 50, description: "Os arquivos que você vai criar, mudar ou apagar, relativos à pasta do projeto." },
    },
    required: ["resumo", "arquivos"],
  },
};

const texto = (t, erro = false) => ({ content: [{ type: "text", text: t }], ...(erro ? { isError: true } : {}) });

// Chama o conector da jam desta pasta.
export async function anunciar(args, env = process.env, cwd = process.cwd()) {
  const resumo = typeof args?.resumo === "string" ? args.resumo.trim() : "";
  const arquivos = Array.isArray(args?.arquivos) ? args.arquivos.filter((a) => typeof a === "string" && a.trim()).map((a) => a.trim()) : [];
  if (!resumo) return texto("Falta o resumo: diga numa frase curta o que você vai fazer.", true);
  const jam = await acharJam([env.CLAUDE_PROJECT_DIR, cwd], pastaDados(env));
  if (!jam) return texto("Esta pasta não está ligada a uma jam do Coodevelopment agora; pode seguir sem anunciar.");
  try {
    const resposta = await fetch(`http://127.0.0.1:${jam.porta}/mcp/anunciar`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${jam.segredo}` },
      body: JSON.stringify({ resumo, arquivos }),
      signal: AbortSignal.timeout(PRAZO_MS),
    });
    if (!resposta.ok) return texto(`O conector da jam recusou o anúncio (${resposta.status}). Tente de novo com um resumo mais curto.`, true);
    const corpo = await resposta.json().catch(() => ({}));
    return texto(typeof corpo.mensagem === "string" ? corpo.mensagem : "Anunciado. Pode editar.");
  } catch {
    return texto("O conector da jam não respondeu. Se ele foi fechado, a pasta não está mais na jam e você pode seguir.", true);
  }
}

// Uma mensagem JSON-RPC; devolve a resposta ou null (notificação).
export async function responder(msg, env = process.env, cwd = process.cwd()) {
  if (!msg || typeof msg !== "object" || typeof msg.method !== "string") return null;
  const id = msg.id;
  const notificacao = id === undefined || id === null;
  const ok = (result) => (notificacao ? null : { jsonrpc: "2.0", id, result });
  switch (msg.method) {
    case "initialize":
      return ok({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : VERSAO_PADRAO,
        capabilities: { tools: {} },
        serverInfo: { name: "coodevelopment", version: "1" },
      });
    case "ping":
      return ok({});
    case "tools/list":
      return ok({ tools: [FERRAMENTA] });
    case "tools/call":
      if (msg.params?.name !== "anunciar") return notificacao ? null : { jsonrpc: "2.0", id, error: { code: -32602, message: "Ferramenta desconhecida" } };
      return ok(await anunciar(msg.params?.arguments, env, cwd));
    default:
      if (msg.method.startsWith("notifications/")) return null;
      return notificacao ? null : { jsonrpc: "2.0", id, error: { code: -32601, message: "Método desconhecido" } };
  }
}
