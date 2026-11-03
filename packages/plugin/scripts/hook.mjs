// Entrada dos hooks do Claude Code (Story 4.1): lê o JSON do hook e avisa o
// conector da jam pelo aviso.mjs. Qualquer erro sai em silêncio com código 0.
import { PRAZO_MS, rodar } from "./aviso.mjs";

// Contado desde que o processo subiu, não desde a leitura da entrada.
const fim = setTimeout(() => process.exit(0), Math.max(0, PRAZO_MS - process.uptime() * 1000));
try {
  let texto = "";
  for await (const pedaco of process.stdin) texto += pedaco;
  await rodar(JSON.parse(texto));
} catch {
  // Sem jam, sem conector, entrada estranha: nada a fazer.
}
clearTimeout(fim);
process.exit(0);
