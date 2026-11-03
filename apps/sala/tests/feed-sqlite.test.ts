import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { ArmazenamentoFeedSqlite } from "../src/armazenamento-sqlite";

// O feed no SQLite de um Durable Object de verdade (Story 3.4; gate da 3.4,
// TEST-001): retenção e linha que não passa no protocolo.

const conflito = (i: number) => ({
  tipo: "conflito" as const,
  autorId: "lucas",
  outroId: "pai",
  caminho: `f${i}.ts`,
  resolvido: "guardado" as const,
  em: "2026-11-03T12:00:00.000Z",
  atualizadoEm: "2026-11-03T12:00:00.000Z",
});

describe("ArmazenamentoFeedSqlite", () => {
  it("guarda os 200 mais novos, devolve do mais novo ao mais antigo e atualiza pelo id", async () => {
    const stub = env.Jam.get(env.Jam.idFromName("jam-retencao"));
    await runInDurableObject(stub, (_instancia, estado) => {
      const a = new ArmazenamentoFeedSqlite(estado.storage.sql);
      let ultimo = 0;
      for (let i = 0; i < 205; i++) ultimo = a.inserir(conflito(i));
      const todos = a.ultimos(500);
      expect(todos).toHaveLength(200);
      expect(todos[0]).toMatchObject({ id: ultimo, caminho: "f204.ts" });
      expect(todos.at(-1)).toMatchObject({ caminho: "f5.ts" });
      a.atualizar({ ...conflito(204), id: ultimo, caminho: "mudou.ts" });
      expect(a.ultimos(1)[0]).toMatchObject({ id: ultimo, caminho: "mudou.ts" });
    });
  });

  it("linha que não passa no protocolo fica de fora, sem derrubar a leitura", async () => {
    const stub = env.Jam.get(env.Jam.idFromName("jam-linha-ruim"));
    await runInDurableObject(stub, (_instancia, estado) => {
      const a = new ArmazenamentoFeedSqlite(estado.storage.sql);
      a.inserir(conflito(1));
      estado.storage.sql.exec("insert into feed (dados) values ('não é json')");
      estado.storage.sql.exec(`insert into feed (dados) values ('{"tipo":"aviso"}')`);
      expect(a.ultimos(10)).toEqual([expect.objectContaining({ caminho: "f1.ts" })]);
    });
  });
});
