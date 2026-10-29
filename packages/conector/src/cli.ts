import { ambienteReal } from "./ambiente";
import { executar } from "./comandos";

// No entrar, Ctrl+C desliga a pasta da jam com calma (fecha a conexão e apaga
// o arquivo de descoberta); um segundo Ctrl+C sai na hora. Nos outros
// comandos, Ctrl+C sai na hora, como sempre (gate da 3.1, REL-004).
const parar =
  process.argv[2] === "entrar"
    ? new Promise<void>((resolve) => {
        process.once("SIGINT", () => {
          resolve();
          process.once("SIGINT", () => process.exit(130));
        });
      })
    : undefined;

const { saida, codigo } = await executar(process.argv.slice(2), ambienteReal(), parar);
if (saida) {
  if (codigo === 0) console.log(saida);
  else console.error(saida);
}
process.exit(codigo);
