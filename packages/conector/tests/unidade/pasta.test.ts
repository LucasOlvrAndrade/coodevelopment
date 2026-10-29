import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { clonar, conferirPasta, destinoDoClone, mesmoRepo, PastaErrada, repoDoOrigin } from "../../src/pasta";
import { ambienteFalso } from "../apoio/ambiente-falso";

describe("repoDoOrigin", () => {
  it("lê dono e nome em https e ssh, com ou sem .git", () => {
    for (const url of [
      "https://github.com/LucasOlvrAndrade/projeto.git",
      "https://github.com/LucasOlvrAndrade/projeto",
      "https://usuario@github.com/LucasOlvrAndrade/projeto.git",
      "git@github.com:LucasOlvrAndrade/projeto.git",
      "ssh://git@github.com/LucasOlvrAndrade/projeto.git\n",
    ]) {
      expect(repoDoOrigin(url)).toEqual({ owner: "LucasOlvrAndrade", nome: "projeto" });
    }
  });

  it("origin de outro lugar não é repositório do GitHub", () => {
    expect(repoDoOrigin("https://gitlab.com/lucas/projeto.git")).toBeNull();
    expect(repoDoOrigin("https://github.com.mal.com/lucas/projeto.git")).toBeNull();
    expect(repoDoOrigin("C:\\repos\\projeto")).toBeNull();
  });

  it("dono e nome sem diferença de maiúscula, como no GitHub", () => {
    expect(mesmoRepo({ owner: "Lucas", nome: "Projeto" }, { owner: "lucas", nome: "projeto" })).toBe(true);
    expect(mesmoRepo({ owner: "lucas", nome: "projeto" }, { owner: "lucas", nome: "outro" })).toBe(false);
  });
});

const REPO = { owner: "lucas", nome: "projeto" };

function gitFalso(origin: string | null, branch = "main") {
  return (programa: string, argumentos: string[]) => {
    if (programa !== "git") return { codigo: 127 };
    if (argumentos[0] === "remote") return origin ? { saida: `${origin}\n` } : { codigo: 2 };
    if (argumentos[0] === "branch") return { saida: `${branch}\n` };
    return {};
  };
}

describe("conferirPasta (Story 3.1, AC 2)", () => {
  it("a pasta do repositório da jam passa", async () => {
    const { amb, linhas } = ambienteFalso({ rodar: gitFalso("git@github.com:Lucas/Projeto.git") });
    await conferirPasta(amb, "C:/p", REPO, "main");
    expect(linhas).toEqual([]);
  });

  it("repositório diferente para, dizendo qual é qual", async () => {
    const { amb } = ambienteFalso({ rodar: gitFalso("https://github.com/lucas/outro.git") });
    await expect(conferirPasta(amb, "C:/p", REPO, "main")).rejects.toThrow(new PastaErrada("A pasta C:/p é do repositório lucas/outro, mas a jam usa lucas/projeto. Rode o comando numa pasta vazia ou na pasta desse repositório."));
  });

  it("sem origin, para", async () => {
    const { amb } = ambienteFalso({ rodar: gitFalso(null) });
    await expect(conferirPasta(amb, "C:/p", REPO, "main")).rejects.toBeInstanceOf(PastaErrada);
  });

  it("branch diferente só avisa", async () => {
    const { amb, linhas } = ambienteFalso({ rodar: gitFalso("https://github.com/lucas/projeto", "feature") });
    await conferirPasta(amb, "C:/p", REPO, "main");
    expect(linhas).toEqual(["Atenção: esta pasta está na branch feature, e a jam usa main."]);
  });
});

describe("destinoDoClone", () => {
  it("pasta atual vazia: clona nela", async () => {
    const { amb } = ambienteFalso();
    expect(await destinoDoClone(amb, REPO)).toEqual({ pasta: amb.cwd, existe: false });
  });

  it("pasta atual com coisas: clona numa subpasta com o nome do repositório", async () => {
    const { amb } = ambienteFalso();
    writeFileSync(join(amb.cwd, "nota.txt"), "x");
    expect(await destinoDoClone(amb, REPO)).toEqual({ pasta: join(amb.cwd, "projeto"), existe: false });
    mkdirSync(join(amb.cwd, "projeto"));
    writeFileSync(join(amb.cwd, "projeto", "README.md"), "x");
    expect(await destinoDoClone(amb, REPO)).toEqual({ pasta: join(amb.cwd, "projeto"), existe: true });
  });
});

describe("clonar (NFR8)", () => {
  it("o token vai só pelo ambiente do git; a URL e os argumentos ficam limpos", async () => {
    const { amb, rodar } = ambienteFalso({ rodar: () => ({}) });
    await clonar(amb, REPO, "main", "C:/destino", "ghs_segredo");
    const [programa, argumentos, extra] = rodar.mock.calls[0]!;
    expect(programa).toBe("git");
    expect(argumentos).toEqual(["clone", "--branch", "main", "--", "https://github.com/lucas/projeto.git", "C:/destino"]);
    expect(JSON.stringify(argumentos)).not.toContain("ghs_segredo");
    expect(extra?.env).toMatchObject({
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.https://github.com/.extraHeader",
      GIT_CONFIG_VALUE_0: `Authorization: Basic ${Buffer.from("x-access-token:ghs_segredo").toString("base64")}`,
      GIT_TERMINAL_PROMPT: "0",
    });
  });

  it("revoga o token logo depois do clone, com sucesso ou falha", async () => {
    for (const codigo of [0, 128]) {
      const { amb, fetch } = ambienteFalso({ rodar: () => ({ codigo }) });
      await clonar(amb, REPO, "main", "C:/d", "ghs_segredo").catch(() => {});
      expect(fetch).toHaveBeenCalledWith("https://api.github.com/installation/token", expect.objectContaining({ method: "DELETE" }));
      const [, init] = fetch.mock.calls[0]!;
      expect(new Headers(init?.headers).get("authorization")).toBe("Bearer ghs_segredo");
    }
  });

  it("falha do git vira mensagem com a última linha dele", async () => {
    const { amb } = ambienteFalso({ rodar: () => ({ codigo: 128, erro: "Cloning...\nfatal: Remote branch main not found\n" }) });
    await expect(clonar(amb, REPO, "main", "C:/d", "t")).rejects.toThrow("O git clone falhou: fatal: Remote branch main not found");
  });
});
