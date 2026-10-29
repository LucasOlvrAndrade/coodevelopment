import { describe, expect, it } from "vitest";
import { guardarSessao, lerSessao } from "../../src/cofre";
import { diagnosticar, formatarDiagnostico } from "../../src/diagnostico";
import { ambienteFalso } from "../apoio/ambiente-falso";

const tudoInstalado = (programa: string, argumentos: string[]) => {
  if (programa === "git" && argumentos[0] === "--version") return { saida: "git version 2.55.0.windows.3\n" };
  if (programa === "git" && argumentos[0] === "rev-parse") return { saida: "C:/p\n" };
  if (programa === "git" && argumentos[0] === "remote") return { saida: "https://github.com/lucas/projeto.git\n" };
  if (programa === "which" || programa === "where") return { saida: "C:\\Users\\x\\claude.cmd\n" };
  return { codigo: 1 };
};

describe("diagnostico (Story 3.1, AC 4)", () => {
  it("com tudo ligado, cada item ok e nada falta", async () => {
    const { amb } = ambienteFalso({
      rodar: tudoInstalado,
      respostas: {
        "GET /api/auth/get-session": { corpo: { user: { login: "lucas", name: "Lucas" } } },
        "GET /api/saude": { corpo: { app: "ok", banco: "ok", sala: "ok" } },
      },
    });
    await guardarSessao(amb, "s");
    const itens = await diagnosticar(amb);
    expect(itens.map((i) => [i.nome, i.ok])).toEqual([
      ["Node.js", true],
      ["Git", true],
      ["Sessão", true],
      ["App", true],
      ["Sala ao vivo", true],
      ["Pasta", true],
      ["Claude Code", true],
    ]);
    expect(itens.find((i) => i.nome === "Sessão")?.detalhe).toBe("@lucas");
    expect(itens.find((i) => i.nome === "Pasta")?.detalhe).toBe("C:/p (lucas/projeto), sem jam ligada agora");
    expect(formatarDiagnostico(itens)).toMatch(/Tudo pronto para entrar numa jam\.$/);
  });

  it("sem Node novo, sem git, sem sessão e fora de um repositório: diz o que fazer em cada um", async () => {
    const { amb } = ambienteFalso({ versaoNode: "20.11.0", respostas: { "GET /api/saude": { corpo: { app: "ok", banco: "ok", sala: "ok" } } } });
    const itens = await diagnosticar(amb);
    const falta = (nome: string) => itens.find((i) => i.nome === nome)!;
    expect(falta("Node.js")).toMatchObject({ ok: false, detalhe: expect.stringMatching(/precisa do 22 ou mais novo/) });
    expect(falta("Git")).toMatchObject({ ok: false, detalhe: expect.stringMatching(/git-scm\.com/) });
    expect(falta("Sessão")).toMatchObject({ ok: false, detalhe: expect.stringMatching(/comando entrar faz o login/) });
    expect(falta("Pasta")).toMatchObject({ ok: false });
    // O Claude Code é informativo: não conta como falta.
    expect(falta("Claude Code")).toMatchObject({ ok: false, informativo: true });
    expect(formatarDiagnostico(itens)).toMatch(/Faltam 4 itens para entrar numa jam\.$/);
  });

  it("sessão que o app não reconhece é apagada e conta como vencida", async () => {
    const { amb } = ambienteFalso({ rodar: tudoInstalado, respostas: { "GET /api/auth/get-session": { corpo: null } } });
    await guardarSessao(amb, "s");
    const itens = await diagnosticar(amb);
    expect(itens.find((i) => i.nome === "Sessão")).toMatchObject({ ok: false, detalhe: expect.stringMatching(/venceu/) });
    expect(itens.find((i) => i.nome === "App")).toMatchObject({ ok: false });
    expect(await lerSessao(amb)).toBeNull();
  });

  it("sala desligada ou sem resposta conta como falta, com o que esperar", async () => {
    for (const [sala, texto] of [["desligada", /ainda não está no ar/], ["erro", /não respondeu agora/]] as const) {
      const { amb } = ambienteFalso({ rodar: tudoInstalado, respostas: { "GET /api/saude": { corpo: { app: "ok", banco: "ok", sala } } } });
      const item = (await diagnosticar(amb)).find((i) => i.nome === "Sala ao vivo");
      expect(item).toMatchObject({ ok: false, detalhe: expect.stringMatching(texto) });
    }
  });

  it("git antigo conta como falta (REL-007)", async () => {
    const { amb } = ambienteFalso({ rodar: (p, a) => (p === "git" && a[0] === "--version" ? { saida: "git version 2.25.1" } : tudoInstalado(p, a)) });
    expect((await diagnosticar(amb)).find((i) => i.nome === "Git")).toMatchObject({ ok: false, detalhe: expect.stringMatching(/precisa do 2\.31 ou mais novo/) });
  });

  it("o comando sai com erro quando falta algo", async () => {
    const { executar } = await import("../../src/comandos");
    const { amb } = ambienteFalso();
    const { codigo, saida } = await executar(["diagnostico"], amb);
    expect(codigo).toBe(1);
    expect(saida).toContain("falta Git:");
  });
});
