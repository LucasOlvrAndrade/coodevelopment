import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositorio } from "@/servidor/dominio/jam";

const criarJamImportando = vi.fn();
const criarJamComRepositorio = vi.fn();
vi.mock("@/servidor/acoes/jam", () => ({ criarJamImportando, criarJamComRepositorio }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { EscolherRepositorio } = await import("@/componentes/jams/EscolherRepositorio");
const { CriarRepositorio } = await import("@/componentes/jams/CriarRepositorio");
const { AlternarNovaJam } = await import("@/componentes/jams/AlternarNovaJam");

const repo = (nome: string, extra: Partial<Repositorio> = {}): Repositorio => ({
  owner: "LucasOlvrAndrade",
  nome,
  privado: false,
  descricao: null,
  atualizadoEm: null,
  ...extra,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("importar repositório (Story 2.1)", () => {
  it("lista os repositórios e filtra pela busca (AC 1)", () => {
    render(<EscolherRepositorio repositorios={[repo("projeto", { privado: true, descricao: "App da firma" }), repo("site"), repo("outro-projeto")]} />);
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByText("privado")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar repositório" }), { target: { value: "PROJ" } });
    expect(screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value)).toEqual([
      "LucasOlvrAndrade/projeto",
      "LucasOlvrAndrade/outro-projeto",
    ]);
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar repositório" }), { target: { value: "nada" } });
    expect(screen.getByText("Nenhum repositório com esse nome.")).toBeInTheDocument();
  });

  it("Criar jam só habilita com um repositório escolhido, e cria com ele (AC 2)", async () => {
    criarJamImportando.mockResolvedValueOnce({ ok: true, dados: { id: "k7m2-rbq9" } });
    render(<EscolherRepositorio repositorios={[repo("projeto"), repo("site")]} />);
    const criar = screen.getByRole("button", { name: "Criar jam" });
    expect(criar).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /site/ }));
    expect(criar).toBeEnabled();
    fireEvent.click(criar);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/inicio?nova=k7m2-rbq9"));
    expect(criarJamImportando).toHaveBeenCalledWith("LucasOlvrAndrade", "site");
  });

  it("erro do servidor aparece como alerta", async () => {
    criarJamImportando.mockResolvedValueOnce({
      ok: false,
      erro: { codigo: "jam_ja_existe", mensagem: "Já existe uma jam aberta para esse repositório. Ela está no seu Início." },
    });
    render(<EscolherRepositorio repositorios={[repo("projeto")]} />);
    fireEvent.click(screen.getByRole("radio", { name: /projeto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar jam com projeto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma jam aberta para esse repositório.");
    expect(push).not.toHaveBeenCalled();
  });

  it("o botão diz qual repositório vai ser usado, mesmo escondido pelo filtro (gate da 2.1, UX-001)", () => {
    render(<EscolherRepositorio repositorios={[repo("projeto"), repo("site")]} />);
    fireEvent.click(screen.getByRole("radio", { name: /site/ }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar repositório" }), { target: { value: "proj" } });
    expect(screen.getByRole("button", { name: "Criar jam com site" })).toBeEnabled();
    expect(screen.getByRole("status")).toHaveTextContent("1 repositório com esse nome.");
  });

  it("ação que lança (sem rede) vira mensagem, sem derrubar a tela (A11Y-001)", async () => {
    criarJamImportando.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<EscolherRepositorio repositorios={[repo("projeto")]} />);
    fireEvent.click(screen.getByRole("radio", { name: /projeto/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar jam com projeto" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para falar com o servidor");
  });

  it("sem repositórios, explica o All repositories", () => {
    render(<EscolherRepositorio repositorios={[]} />);
    expect(screen.getByText(/All repositories/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Criar jam" })).toBeNull();
  });

  it("com muitos repositórios, mostra 100 e pede para refinar a busca", () => {
    render(<EscolherRepositorio repositorios={Array.from({ length: 150 }, (_, i) => repo(`r${i}`))} />);
    expect(screen.getAllByRole("radio")).toHaveLength(100);
    expect(screen.getByText("Mostrando 100 de 150. Digite parte do nome para achar os outros.")).toBeInTheDocument();
  });
});

describe("criar repositório (Story 2.2)", () => {
  async function preencher(nome: string) {
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do repositório" }), { target: { value: nome } });
  }

  it("alterna entre importar e criar, sem perder o que foi digitado", () => {
    render(<AlternarNovaJam importar={<p>painel de importar</p>} criar={<CriarRepositorio />} />);
    expect(screen.getByRole("button", { name: "Importar repositório" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("painel de importar")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório" }));
    expect(screen.getByRole("button", { name: "Criar repositório" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.change(screen.getByRole("textbox", { name: "Nome do repositório" }), { target: { value: "meu-app" } });
    fireEvent.click(screen.getByRole("button", { name: "Importar repositório" }));
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório" }));
    expect(screen.getByRole("textbox", { name: "Nome do repositório" })).toHaveValue("meu-app");
  });

  it("cria com nome e visibilidade (privado por padrão) e volta ao Início (AC 1)", async () => {
    criarJamComRepositorio.mockResolvedValueOnce({ ok: true, dados: { id: "abcd-efgh" } });
    render(<CriarRepositorio />);
    expect(screen.getByRole("radio", { name: /Privado/ })).toBeChecked();
    await preencher(" meu-app ");
    fireEvent.click(screen.getByRole("radio", { name: /Público/ }));
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório e jam" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/inicio?nova=abcd-efgh"));
    expect(criarJamComRepositorio).toHaveBeenCalledWith("meu-app", false);
  });

  it("nome inválido mostra o erro no campo, sem chamar o servidor", async () => {
    render(<CriarRepositorio />);
    await preencher("com espaço");
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório e jam" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Use só letras, números, ponto, hífen e sublinhado");
    expect(screen.getByRole("textbox", { name: "Nome do repositório" })).toHaveAttribute("aria-invalid", "true");
    expect(criarJamComRepositorio).not.toHaveBeenCalled();
  });

  it("nome que já existe aparece no próprio campo (AC 4)", async () => {
    criarJamComRepositorio.mockResolvedValueOnce({
      ok: false,
      erro: { codigo: "repositorio_ja_existe", mensagem: "Você já tem um repositório com esse nome no GitHub. Escolha outro nome ou importe esse." },
    });
    render(<CriarRepositorio />);
    await preencher("projeto");
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório e jam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Você já tem um repositório com esse nome");
    expect(screen.getByRole("textbox", { name: "Nome do repositório" })).toHaveAccessibleDescription(/Você já tem um repositório com esse nome/);
    expect(push).not.toHaveBeenCalled();
  });

  it("outro erro (instalação parcial) aparece abaixo do formulário", async () => {
    criarJamComRepositorio.mockResolvedValueOnce({
      ok: false,
      erro: { codigo: "instalacao_parcial", mensagem: "Mude para All repositories em https://github.com/settings/installations/77" },
    });
    render(<CriarRepositorio />);
    await preencher("novo");
    fireEvent.click(screen.getByRole("button", { name: "Criar repositório e jam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("settings/installations/77");
    expect(screen.getByRole("textbox", { name: "Nome do repositório" })).not.toHaveAttribute("aria-invalid");
  });
});
