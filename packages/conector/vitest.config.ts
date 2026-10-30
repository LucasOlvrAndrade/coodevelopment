import { defineConfig } from "vitest/config";

// Os arquivos de teste rodam um de cada vez: o teste de integração da Story
// 3.3 mede o tempo de uma mudança chegar à outra pasta (NFR2) com o vigia de
// verdade, e a carga dos outros arquivos rodando junto fazia o Windows perder
// evento do vigia (a varredura recupera, mas depois dos 2 s medidos).
export default defineConfig({
  test: {
    fileParallelism: false,
  },
});
