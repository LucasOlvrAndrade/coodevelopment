import { ambienteReal } from "./ambiente";
import { executar } from "./comandos";

// Ctrl+C desliga a pasta da jam com calma (fecha a conexão e apaga o arquivo
// de descoberta); um segundo Ctrl+C sai na hora.
const parar = new Promise<void>((resolve) => {
  process.once("SIGINT", () => {
    resolve();
    process.once("SIGINT", () => process.exit(130));
  });
});

const { saida, codigo } = await executar(process.argv.slice(2), ambienteReal(), parar);
if (saida) {
  if (codigo === 0) console.log(saida);
  else console.error(saida);
}
process.exit(codigo);
