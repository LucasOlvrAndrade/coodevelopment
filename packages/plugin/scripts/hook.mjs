// Entrada dos hooks do Claude Code (Story 4.1): lê o JSON do hook e avisa o
// conector da jam pelo aviso.mjs. Qualquer erro sai em silêncio com código 0.
import { PRAZO_DO_AVISO_MS, PRAZO_MS, prazoDoHook, rodar } from "./aviso.mjs";

// Contado desde que o processo subiu, não desde a leitura da entrada; mas o
// aviso sempre ganha o seu prazo: com a máquina ocupada, só subir o Node pode
// passar dos 800 ms, e o aviso do Stop se perdia (o status ficava preso).
let fim = setTimeout(() => process.exit(0), Math.max(PRAZO_DO_AVISO_MS + 100, PRAZO_MS - process.uptime() * 1000));
try {
  let texto = "";
  for await (const pedaco of process.stdin) texto += pedaco;
  const entrada = JSON.parse(texto);
  // A edição tem prazo próprio, maior (gate da 4.4, REL-011).
  if (entrada?.hook_event_name === "PreToolUse") {
    clearTimeout(fim);
    fim = setTimeout(() => process.exit(0), prazoDoHook("PreToolUse"));
  }
  // Só a recusa da edição, a pergunta e o contexto dos outros Claudes vão para
  // a saída (o Claude Code lê como decisão e contexto); nada mais é escrito nela.
  const decisao = await rodar(entrada);
  if (decisao) process.stdout.write(JSON.stringify(decisao));
} catch {
  // Sem jam, sem conector, entrada estranha: nada a fazer.
}
clearTimeout(fim);
process.exit(0);
