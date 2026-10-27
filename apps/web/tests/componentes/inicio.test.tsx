import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { JamDoInicio } from "@/servidor/dominio/jam";

const obterSessao = vi.fn(async (): Promise<{ user: { name: string } } | null> => null);
const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const listarJams = vi.fn(async (): Promise<JamDoInicio[]> => []);
vi.mock("@/servidor/auth", () => ({ obterSessao, exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("@/servidor/dominio/jam", () => ({ listarJams }));
vi.mock("@/servidor/acoes/jam", () => ({ tentarDeNovo: vi.fn() }));

const { JamsDoUsuario, Saudacao } = await import("@/app/(app)/inicio/page");

const jam = (id: string, repoNome: string, estado: JamDoInicio["estado"]): JamDoInicio => ({
  id,
  nome: repoNome,
  repoOwner: "LucasOlvrAndrade",
  repoNome,
  estado,
  criadorId: "lucas",
  participantes: [
    { id: "lucas", login: "lucas", nome: "Lucas Andrade", foto: null, papel: "criador", colaborador: "ok" },
    { id: "pai", login: "pai-dev", nome: "Pai", foto: null, papel: "convidado", colaborador: "ok" },
  ],
});

describe("Início", () => {
  it("sem jams: diz isso e leva a Criar jam e a Amigos", async () => {
    render(await JamsDoUsuario({ busca: Promise.resolve({}) }));
    expect(screen.getByText("Você ainda não tem nenhuma jam.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Criar jam" })).toHaveAttribute("href", "/jams/nova");
    expect(screen.getByRole("link", { name: "Adicionar amigos" })).toHaveAttribute("href", "/amigos");
  });

  it("lista as jams com o repositório e quem está nelas (FR7), com a nova em destaque", async () => {
    listarJams.mockResolvedValueOnce([jam("k7m2-rbq9", "projeto", "aberta"), jam("abcd-efgh", "antigo", "fechada")]);
    render(await JamsDoUsuario({ busca: Promise.resolve({ nova: "k7m2-rbq9" }) }));
    expect(within(screen.getByRole("list", { name: "Suas jams" })).getByText("LucasOlvrAndrade/projeto")).toBeInTheDocument();
    expect(screen.getByText(/Jam criada agora · Aberta · código k7m2-rbq9/)).toBeInTheDocument();
    expect(screen.getByText(/Fechada · código abcd-efgh/)).toBeInTheDocument();
    const quem = screen.getByRole("list", { name: "Quem está na jam projeto" });
    expect(within(quem).getByText("Lucas Andrade")).toBeInTheDocument();
    expect(within(quem).getByText("Pai")).toBeInTheDocument();
    expect(listarJams).toHaveBeenCalledWith({}, "lucas");
  });

  it("não usa travessão no texto", async () => {
    listarJams.mockResolvedValueOnce([jam("k7m2-rbq9", "projeto", "aberta")]);
    const { container } = render(await JamsDoUsuario({ busca: Promise.resolve({}) }));
    expect(container.textContent).not.toContain("—");
  });

  it("cumprimenta pelo primeiro nome do GitHub", async () => {
    obterSessao.mockResolvedValueOnce({ user: { name: "Lucas de Oliveira Andrade" } });
    render(await Saudacao());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Olá, Lucas");
  });
});
