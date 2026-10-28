import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JamCompleta } from "@/servidor/dominio/jam";

const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const obterJam = vi.fn(async (): Promise<JamCompleta | null> => null);
const listarAmigos = vi.fn(async () => [
  { id: "pai", login: "pai-dev", nome: "Pai", foto: null, desde: new Date() },
  { id: "ana", login: "ana", nome: "Ana", foto: null, desde: new Date() },
]);
const chamarAmigos = vi.fn();
const excluirJam = vi.fn();
const tentarDeNovo = vi.fn();
const push = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("@/servidor/dominio/jam", () => ({ obterJam }));
vi.mock("@/servidor/dominio/amizade", () => ({ listarAmigos }));
vi.mock("@/servidor/acoes/jam", () => ({ chamarAmigos, excluirJam, tentarDeNovo }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ push }) }));

const { ConteudoDaJam } = await import("@/app/(app)/jams/[id]/page");

function jam(extra: Partial<JamCompleta> = {}): JamCompleta {
  return {
    id: "k7m2-rbq9",
    nome: "projeto",
    repoOwner: "lucas",
    repoNome: "projeto",
    branch: "main",
    estado: "aberta",
    criadorId: "lucas",
    participantes: [
      { id: "lucas", login: "lucas", nome: "Lucas", foto: null, papel: "criador", colaborador: "ok", vaga: 1 },
      { id: "pai", login: "pai-dev", nome: "Pai", foto: null, papel: "convidado", colaborador: "falhou", vaga: 2 },
    ],
    ...extra,
  };
}

async function abrir(id = "k7m2-rbq9") {
  render(await ConteudoDaJam({ params: Promise.resolve({ id }) }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("página da jam (Story 2.4)", () => {
  it("mostra o repositório, o link do GitHub e quem está na jam com a situação (AC 1)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    await abrir();
    expect(screen.getByRole("heading", { level: 1, name: "lucas/projeto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir o repositório no GitHub" })).toHaveAttribute("href", "https://github.com/lucas/projeto");
    expect(screen.getByText(/código k7m2-rbq9/)).toBeInTheDocument();
    const quem = screen.getByRole("list", { name: "Quem está na jam" });
    expect(within(quem).getByText("No repositório")).toBeInTheDocument();
    expect(within(quem).getByText("Não entrou no repositório")).toBeInTheDocument();
    expect(obterJam).toHaveBeenCalledWith({}, "lucas", "k7m2-rbq9");
  });

  it("o criador chama mais amigos (só quem não está) e tenta de novo quem não entrou (AC 2)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    await abrir();
    expect(screen.getByRole("checkbox", { name: /Ana/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Pai/ })).toBeNull();
    expect(screen.getByText("(0 de 1 vaga)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo com Pai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir jam" })).toBeInTheDocument();
  });

  it("quem não criou não vê os controles; com convite pendente, vê o link dele", async () => {
    exigirSessao.mockResolvedValueOnce({ id: "pai" });
    obterJam.mockResolvedValueOnce(
      jam({
        participantes: [
          { id: "lucas", login: "lucas", nome: "Lucas", foto: null, papel: "criador", colaborador: "ok", vaga: 1 },
          { id: "pai", login: "pai-dev", nome: "Pai", foto: null, papel: "convidado", colaborador: "pendente", vaga: 2 },
        ],
      }),
    );
    await abrir();
    expect(screen.getByRole("link", { name: "Aceite o convite do repositório no GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/lucas/projeto/invitations",
    );
    expect(screen.queryByRole("button", { name: "Excluir jam" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(listarAmigos).not.toHaveBeenCalled();
  });

  it("jam completa não oferece chamar mais ninguém", async () => {
    obterJam.mockResolvedValueOnce(
      jam({
        participantes: [
          { id: "lucas", login: "lucas", nome: "Lucas", foto: null, papel: "criador", colaborador: "ok", vaga: 1 },
          { id: "pai", login: "pai-dev", nome: "Pai", foto: null, papel: "convidado", colaborador: "ok", vaga: 2 },
          { id: "ana", login: "ana", nome: "Ana", foto: null, papel: "convidado", colaborador: "ok", vaga: 3 },
        ],
      }),
    );
    await abrir();
    expect(screen.getByText("A jam está completa: até 3 pessoas por enquanto.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("quem não participa (ou jam que não existe) cai na 404 (AC 3)", async () => {
    obterJam.mockResolvedValueOnce(null);
    await expect(ConteudoDaJam({ params: Promise.resolve({ id: "nao-existe" }) })).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("chamar mais amigos usa a ação da 2.3 e diz quem foi chamado", async () => {
    obterJam.mockResolvedValueOnce(jam());
    chamarAmigos.mockResolvedValueOnce({ ok: true, dados: [{ amigoId: "ana", estado: "pendente" }] });
    await abrir();
    fireEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chamar para a jam" }));
    await waitFor(() => expect(chamarAmigos).toHaveBeenCalledWith("k7m2-rbq9", ["ana"]));
    expect(await screen.findByText("Ana foi chamado para a jam.")).toBeInTheDocument();
  });

  it("excluir pede confirmação e volta às jams (AC 5)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    excluirJam.mockResolvedValueOnce({ ok: true, dados: undefined });
    await abrir();
    fireEvent.click(screen.getByRole("button", { name: "Excluir jam" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir a jam de lucas/projeto?" });
    expect(dialogo).toHaveTextContent("O repositório no GitHub não muda");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir jam" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/inicio"));
    expect(excluirJam).toHaveBeenCalledWith("k7m2-rbq9");
  });

  it("não usa travessão no texto", async () => {
    obterJam.mockResolvedValueOnce(jam());
    await abrir();
    expect(document.body.textContent).not.toContain("—");
  });
});
