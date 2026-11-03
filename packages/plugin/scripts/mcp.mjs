// Servidor MCP do Coodevelopment (Story 4.2): fala MCP por stdio (JSON-RPC,
// uma mensagem por linha) sem dependências; a lógica está em anunciar.mjs.
import { createInterface } from "node:readline";
import { responder } from "./anunciar.mjs";

const escrever = (m) => process.stdout.write(`${JSON.stringify(m)}\n`);

// Respostas em andamento: quando a entrada fecha, o servidor só sai depois
// delas (o anunciar espera o conector).
const pendentes = new Set();

const linhas = createInterface({ input: process.stdin });
linhas.on("line", (linha) => {
  if (!linha.trim()) return;
  let msg;
  try {
    msg = JSON.parse(linha);
  } catch {
    escrever({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "JSON inválido" } });
    return;
  }
  const vez = responder(msg)
    .catch((e) => (msg.id == null ? null : { jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e) } }))
    .then((resposta) => {
      if (resposta) escrever(resposta);
    })
    .finally(() => pendentes.delete(vez));
  pendentes.add(vez);
});
linhas.on("close", async () => {
  await Promise.allSettled([...pendentes]);
  process.exit(0);
});
