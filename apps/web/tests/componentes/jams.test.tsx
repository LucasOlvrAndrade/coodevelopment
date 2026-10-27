import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Repositorio } from "@/servidor/dominio/jam";

const criarJamImportando = vi.fn();
vi.mock("@/servidor/acoes/jam", () => ({ criarJamImportando }));
const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { EscolherRepositorio } = await import("@/componentes/jams/EscolherRepositorio");

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
    fireEvent.click(screen.getByRole("button", { name: "Criar jam" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Já existe uma jam aberta para esse repositório.");
    expect(push).not.toHaveBeenCalled();
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
