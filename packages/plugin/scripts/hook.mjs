// Entrada dos hooks do Claude Code (Story 4.1): lê o JSON do hook e avisa o
// conector da jam pelo aviso.mjs. Qualquer erro sai em silêncio com código 0.
import { PRAZO_DO_AVISO_MS, PRAZO_MS, rodar } from "./aviso.mjs";

// Contado desde que o processo subiu, não desde a leitura da entrada; mas o
// aviso sempre ganha o seu prazo: com a máquina ocupada, só subir o Node pode
// passar dos 800 ms, e o aviso do Stop se perdia (o status ficava preso).
const fim = setTimeout(() => process.exit(0), Math.max(PRAZO_DO_AVISO_MS + 100, PRAZO_MS - process.uptime() * 1000));
try {
  let texto = "";
  for await (const pedaco of process.stdin) texto += pedaco;
  // Só a recusa da edição vai para a saída (o Claude Code lê como decisão);
  // nada mais é escrito nela, porque viraria contexto do Claude.
  const decisao = await rodar(JSON.parse(texto));
  if (decisao) process.stdout.write(JSON.stringify(decisao));
} catch {
  // Sem jam, sem conector, entrada estranha: nada a fazer.
}
clearTimeout(fim);
process.exit(0);
