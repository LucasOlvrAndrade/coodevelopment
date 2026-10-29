import { beforeEach, describe, expect, it, vi } from "vitest";
import { guardarSessao, lerSessao } from "../../src/cofre";
import { lerPasta } from "../../src/descoberta";
import { ambienteFalso, type RespostaFalsa } from "../apoio/ambiente-falso";

// A sala de verdade é testada no workerd (apps/sala); aqui ela é simulada:
// conecta na hora e fica aberta até fechar.
const sala = vi.hoisted(() => ({ conectar: vi.fn() }));
vi.mock("../../src/sala", () => ({ conectarNaSala: sala.conectar }));

const { executar } = await import("../../src/comandos");

const JAM = { jamId: "k7m2-rbq9", nome: "projeto", estado: "aberta", repo: { owner: "lucas", nome: "projeto", id: 1296269 }, branch: "main" };

function salaQueConecta(recusa?: string) {
  sala.conectar.mockImplementation(async (_amb, _sessao, _jam, aoConectar: () => void) => {
    aoConectar();
    let fechar: (m: string) => void = () => {};
    const fechou = new Promise<string>((r) => (fechar = r));
    if (recusa) fechar(recusa);
    return { fechar: () => fechar(""), fechou };
  });
}

// O git responde como uma pasta que já é o repositório da jam (ou outro).
const gitDaPasta = (raiz: string, origin = "https://github.com/lucas/projeto.git") => (programa: string, argumentos: string[]) => {
  if (programa !== "git") return { codigo: 127 };
  if (argumentos[0] === "rev-parse") return { saida: `${raiz}\n` };
  if (argumentos[0] === "remote") return { saida: `${origin}\n` };
  if (argumentos[0] === "branch") return { saida: "main\n" };
  return {};
};

function comRespostas(extra: Record<string, RespostaFalsa | RespostaFalsa[]> = {}) {
  return { "GET /api/jams/k7m2-rbq9/conector": { corpo: JAM }, ...extra };
}

describe("entrar (Story 3.1)", () => {
  beforeEach(() => {
    sala.conectar.mockReset();
  });

  it("com sessão guardada e a pasta do repositório: conecta, registra a pasta e desliga no Ctrl+C", async () => {
    salaQueConecta();
    const raiz = "C:/projetos/projeto";
    const { amb, linhas, pedidos } = ambienteFalso({ respostas: comRespostas(), rodar: gitDaPasta(raiz) });
    await guardarSessao(amb, "sessao-guardada");
    let ctrlC: () => void = () => {};
    const parar = new Promise<void>((r) => (ctrlC = r));

    const resultado = executar(["entrar", "k7m2-rbq9"], amb, parar);
    await vi.waitFor(async () => expect(await lerPasta(amb, raiz)).toMatchObject({ jamId: "k7m2-rbq9", pid: process.pid }));
    expect(linhas).toContain("Conectado à jam projeto. Deixe esta janela aberta; Ctrl+C desliga.");
    expect(pedidos[0]).toMatchObject({ caminho: "/api/jams/k7m2-rbq9/conector", cabecalhos: { authorization: "Bearer sessao-guardada" } });
    expect(sala.conectar).toHaveBeenCalledWith(amb, "sessao-guardada", "k7m2-rbq9", expect.any(Function));

    ctrlC();
    expect(await resultado).toEqual({ saida: "", codigo: 0 });
    expect(await lerPasta(amb, raiz)).toBeNull();
    expect(linhas.at(-1)).toBe("Desligado da jam.");
  });

  it("sem sessão: faz o login por dispositivo e guarda a sessão", async () => {
    salaQueConecta("A sala recusou a entrada. Rode o comando de novo.");
    const { amb } = ambienteFalso({
      respostas: comRespostas({
        "POST /api/auth/device/code": { corpo: { device_code: "d", user_code: "ABCDEFGH", verification_uri: "https://app.teste/dispositivo", verification_uri_complete: "https://app.teste/dispositivo?user_code=ABCDEFGH", expires_in: 600, interval: 5 } },
        "POST /api/auth/device/token": { corpo: { access_token: "sessao-nova" } },
      }),
      rodar: gitDaPasta("C:/p"),
    });
    const { saida, codigo } = await executar(["entrar", "k7m2-rbq9"], amb);
    expect(await lerSessao(amb)).toBe("sessao-nova");
    // A sala recusou: o comando para com a explicação e apaga o registro da pasta.
    expect({ saida, codigo }).toEqual({ saida: "A sala recusou a entrada. Rode o comando de novo.", codigo: 1 });
    expect(await lerPasta(amb, "C:/p")).toBeNull();
  });

  it("sessão guardada que venceu (401): apaga, faz o login de novo e segue", async () => {
    salaQueConecta("fim");
    const { amb, linhas, pedidos } = ambienteFalso({
      respostas: {
        "GET /api/jams/k7m2-rbq9/conector": [{ status: 401, corpo: { error: { code: "sem_sessao", message: "x" } } }, { corpo: JAM }],
        "POST /api/auth/device/code": { corpo: { device_code: "d", user_code: "ABCDEFGH", verification_uri: "https://app.teste/dispositivo", verification_uri_complete: "https://app.teste/dispositivo?user_code=ABCDEFGH", expires_in: 600, interval: 5 } },
        "POST /api/auth/device/token": { corpo: { access_token: "sessao-nova" } },
      },
      rodar: gitDaPasta("C:/p"),
    });
    await guardarSessao(amb, "sessao-velha");
    await executar(["entrar", "k7m2-rbq9"], amb);
    expect(linhas).toContain("Sua sessão deste computador venceu. Vamos entrar de novo.");
    expect(pedidos.filter((p) => p.caminho.endsWith("/conector")).map((p) => p.cabecalhos.authorization)).toEqual(["Bearer sessao-velha", "Bearer sessao-nova"]);
  });

  it("quem não participa recebe uma frase, sem clonar nada", async () => {
    const { amb, rodar } = ambienteFalso({
      respostas: { "GET /api/jams/k7m2-rbq9/conector": { status: 403, corpo: { error: { code: "nao_participa", message: "x" } } } },
    });
    await guardarSessao(amb, "s");
    expect(await executar(["entrar", "k7m2-rbq9"], amb)).toEqual({ saida: "Você não participa dessa jam. Peça para quem criou te chamar.", codigo: 1 });
    expect(rodar).not.toHaveBeenCalled();
  });

  it("pasta de outro repositório para antes da sala", async () => {
    const { amb } = ambienteFalso({ respostas: comRespostas(), rodar: gitDaPasta("C:/outro", "https://github.com/lucas/outro.git") });
    await guardarSessao(amb, "s");
    const { saida, codigo } = await executar(["entrar", "k7m2-rbq9"], amb);
    expect(codigo).toBe(1);
    expect(saida).toMatch(/é do repositório lucas\/outro, mas a jam usa lucas\/projeto/);
    expect(sala.conectar).not.toHaveBeenCalled();
  });

  it("pasta vazia: pede o token de clone e clona nela", async () => {
    salaQueConecta("fim");
    const clones: string[][] = [];
    const { amb, pedidos } = ambienteFalso({
      respostas: comRespostas({ "POST /api/conector/clone-token": { corpo: { token: "ghs_x", expiraEm: "2026-10-29T13:00:00Z" } } }),
      rodar: (programa, argumentos) => {
        if (argumentos[0] === "rev-parse") return { codigo: 128 };
        if (argumentos[0] === "clone") clones.push(argumentos);
        return {};
      },
    });
    await guardarSessao(amb, "s");
    await executar(["entrar", "k7m2-rbq9"], amb);
    expect(pedidos.find((p) => p.caminho === "/api/conector/clone-token")?.corpo).toEqual({ jamId: "k7m2-rbq9" });
    expect(clones).toEqual([["clone", "--branch", "main", "--", "https://github.com/lucas/projeto.git", amb.cwd]]);
  });

  it("sala fora do ar (503): a pasta fica pronta e o comando explica", async () => {
    sala.conectar.mockRejectedValueOnce(new (await import("../../src/api")).ErroApi(503, "sala_indisponivel", "x"));
    const { amb } = ambienteFalso({ respostas: comRespostas(), rodar: gitDaPasta("C:/p") });
    await guardarSessao(amb, "s");
    const { saida, codigo } = await executar(["entrar", "k7m2-rbq9"], amb);
    expect(codigo).toBe(1);
    expect(saida).toMatch(/A sala ao vivo da jam ainda não está no ar/);
  });

  it("jam fechada não conecta", async () => {
    const { amb } = ambienteFalso({ respostas: { "GET /api/jams/k7m2-rbq9/conector": { corpo: { ...JAM, estado: "fechada" } } } });
    await guardarSessao(amb, "s");
    expect(await executar(["entrar", "k7m2-rbq9"], amb)).toEqual({ saida: "A jam projeto está fechada.", codigo: 1 });
  });
});
