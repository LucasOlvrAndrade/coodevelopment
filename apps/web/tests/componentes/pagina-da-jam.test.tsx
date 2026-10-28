import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { JamCompleta } from "@/servidor/dominio/jam";

const exigirSessao = vi.fn(async () => ({ id: "lucas" }));
const obterJam = vi.fn(async (): Promise<JamCompleta | null> => null);
const listarAmigos = vi.fn(async () => [
  { id: "pai", login: "pai-dev", nome: "Pai", foto: null, desde: new Date() },
  { id: "ana", login: "ana", nome: "Ana", foto: null, desde: new Date() },
]);
const sincronizarComPrazo = vi.fn<(eu: string) => Promise<void>>(async () => {});
const chamarAmigos = vi.fn();
const excluirJam = vi.fn();
const tentarDeNovo = vi.fn();
const push = vi.fn();
const replace = vi.fn();
const refresh = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("@/servidor/auth", () => ({ exigirSessao }));
vi.mock("@/servidor/db", () => ({ db: () => ({}) }));
vi.mock("@/servidor/dominio/jam", async (original) => ({
  idDeJamValido: (await original<typeof import("@/servidor/dominio/jam")>()).idDeJamValido,
  obterJam,
}));
vi.mock("@/servidor/dominio/amizade", () => ({ listarAmigos }));
vi.mock("@/servidor/sincronizar-pendentes", () => ({ sincronizarComPrazo }));
vi.mock("@/servidor/acoes/jam", () => ({ chamarAmigos, excluirJam, tentarDeNovo }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ push, replace, refresh }) }));

const { ConteudoDaJam } = await import("@/app/(app)/jams/[id]/page");
const { default: NaoEncontrada } = await import("@/app/(app)/not-found");

const lucas = { id: "lucas", login: "lucas", nome: "Lucas", foto: null, papel: "criador" as const, colaborador: "ok" as const, vaga: 1 };
const pai = { id: "pai", login: "pai-dev", nome: "Pai", foto: null, papel: "convidado" as const, colaborador: "falhou" as const, vaga: 2 };
const ana = { id: "ana", login: "ana", nome: "Ana", foto: null, papel: "convidado" as const, colaborador: "ok" as const, vaga: 3 };

function jam(extra: Partial<JamCompleta> = {}): JamCompleta {
  return {
    id: "k7m2-rbq9",
    nome: "projeto",
    repoOwner: "lucas",
    repoNome: "projeto",
    branch: "main",
    estado: "aberta",
    criadorId: "lucas",
    participantes: [lucas, pai],
    ...extra,
  };
}

async function pagina(id = "k7m2-rbq9") {
  return ConteudoDaJam({ params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("página da jam (Story 2.4)", () => {
  it("mostra o repositório, o link do GitHub e quem está na jam com a situação (AC 1)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    render(await pagina());
    expect(screen.getByRole("heading", { level: 1, name: "lucas/projeto" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir o repositório no GitHub" })).toHaveAttribute("href", "https://github.com/lucas/projeto");
    // Situação e código separados para o leitor de tela (gate da 2.4, A11Y-003).
    expect(screen.getByText("código k7m2-rbq9").parentElement).toHaveTextContent("Aberta, código k7m2-rbq9");
    expect(screen.getByText("main")).toBeInTheDocument();
    const quem = screen.getByRole("list", { name: "Quem está na jam" });
    expect(within(quem).getByText("@pai-dev · convidado")).toBeInTheDocument();
    expect(within(quem).getByText("@lucas · criou a jam")).toBeInTheDocument();
    expect(within(quem).getByText("No repositório")).toBeInTheDocument();
    expect(within(quem).getByText("Não entrou no repositório")).toBeInTheDocument();
    expect(obterJam).toHaveBeenCalledWith({}, "lucas", "k7m2-rbq9");
  });

  it("antes de mostrar, confere quem aceitou o convite pelo link (gate da 2.4, REL-003)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    render(await pagina());
    expect(sincronizarComPrazo).toHaveBeenCalledWith("lucas");
  });

  it("o criador chama mais amigos (só quem não está) e tenta de novo quem não entrou (AC 2)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    render(await pagina());
    expect(screen.getByRole("checkbox", { name: /Ana/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: /Pai/ })).toBeNull();
    expect(screen.getByText("(0 de 1 vaga)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tentar de novo com Pai" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Excluir jam" })).toBeInTheDocument();
  });

  it("quem não criou não vê os controles; com convite pendente, vê o link dele", async () => {
    exigirSessao.mockResolvedValueOnce({ id: "pai" });
    obterJam.mockResolvedValueOnce(jam({ participantes: [lucas, { ...pai, colaborador: "pendente" }] }));
    render(await pagina());
    expect(screen.getByRole("link", { name: "Aceite o convite do repositório no GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/lucas/projeto/invitations",
    );
    expect(screen.queryByRole("button", { name: "Excluir jam" })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(listarAmigos).not.toHaveBeenCalled();
  });

  it("jam completa não oferece chamar mais ninguém", async () => {
    obterJam.mockResolvedValueOnce(jam({ participantes: [lucas, { ...pai, colaborador: "ok" }, ana] }));
    render(await pagina());
    expect(screen.getByText("A jam está completa: até 3 pessoas por enquanto.")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("quem não participa (ou jam que não existe) cai na 404 (AC 3)", async () => {
    obterJam.mockResolvedValueOnce(null);
    await expect(pagina("zzzz-zzzz")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("id fora do formato cai na 404 sem ir ao banco (gate da 2.4, REL-001)", async () => {
    for (const id of ["nao-existe", "K7M2-RBQ9", "k7m2-rbq9-extra", "k7m2%00rbq9"]) {
      await expect(pagina(id)).rejects.toThrow("NEXT_NOT_FOUND");
    }
    expect(obterJam).not.toHaveBeenCalled();
    expect(sincronizarComPrazo).not.toHaveBeenCalled();
  });

  it("a 404 em português leva de volta às jams", () => {
    render(<NaoEncontrada />);
    expect(screen.getByRole("heading", { level: 1, name: "Não achei essa página" })).toBeInTheDocument();
    expect(screen.getByText(/não existe, foi excluída ou você não participa/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para as jams" })).toHaveAttribute("href", "/inicio");
  });

  it("chamar mais amigos usa a ação da 2.3 e diz quem entrou, com texto neutro (UX-004)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    chamarAmigos.mockResolvedValueOnce({ ok: true, dados: [{ amigoId: "ana", estado: "pendente" }] });
    render(await pagina());
    fireEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    fireEvent.click(screen.getByRole("button", { name: "Chamar para a jam" }));
    await waitFor(() => expect(chamarAmigos).toHaveBeenCalledWith("k7m2-rbq9", ["ana"]));
    expect(await screen.findByText("Ana está na jam agora.")).toBeInTheDocument();
  });

  it("a mensagem fica e o foco vem para ela quando a página volta sem o botão (gate da 2.4, A11Y-001)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    chamarAmigos.mockResolvedValueOnce({ ok: true, dados: [{ amigoId: "ana", estado: "falhou", motivo: "O GitHub recusou." }] });
    const { rerender } = render(await pagina());
    fireEvent.click(screen.getByRole("checkbox", { name: /Ana/ }));
    const botao = screen.getByRole("button", { name: "Chamar para a jam" });
    botao.focus();
    fireEvent.click(botao);
    expect(await screen.findByText("Ana não entrou no repositório. O GitHub recusou.")).toBeInTheDocument();
    // A página volta do servidor com a jam completa: "Chamar mais amigos" some.
    obterJam.mockResolvedValueOnce(jam({ participantes: [lucas, pai, { ...ana, colaborador: "falhou" }] }));
    rerender(await pagina());
    expect(screen.queryByRole("button", { name: "Chamar para a jam" })).toBeNull();
    const mensagem = screen.getByText("Ana não entrou no repositório. O GitHub recusou.");
    expect(within(screen.getByRole("alert")).getByText("Ana não entrou no repositório. O GitHub recusou.")).toBe(mensagem);
    await waitFor(() => expect(mensagem.closest("[tabindex='-1']")).toHaveFocus());
  });

  it('"Tentar de novo" que dá certo: o botão some e a mensagem fica com o foco', async () => {
    obterJam.mockResolvedValueOnce(jam());
    tentarDeNovo.mockResolvedValueOnce({ ok: true, dados: { estado: "ok" } });
    const { rerender } = render(await pagina());
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo com Pai" }));
    expect(await screen.findByText("Pai está no repositório agora.")).toBeInTheDocument();
    obterJam.mockResolvedValueOnce(jam({ participantes: [lucas, { ...pai, colaborador: "ok" }] }));
    rerender(await pagina());
    expect(screen.queryByRole("button", { name: "Tentar de novo com Pai" })).toBeNull();
    await waitFor(() => expect(screen.getByText("Pai está no repositório agora.").closest("[tabindex='-1']")).toHaveFocus());
  });

  it("jam fechada não oferece tentar de novo nem chamar mais amigos", async () => {
    obterJam.mockResolvedValueOnce(jam({ estado: "fechada" }));
    render(await pagina());
    expect(screen.queryByRole("button", { name: /Tentar de novo/ })).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("excluir pede confirmação e volta às jams sem deixar a jam no histórico (AC 5, REL-002)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    excluirJam.mockResolvedValueOnce({ ok: true, dados: undefined });
    render(await pagina());
    fireEvent.click(screen.getByRole("button", { name: "Excluir jam" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Excluir a jam de lucas/projeto?" });
    expect(dialogo).toHaveTextContent("O repositório no GitHub não muda");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir jam" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inicio"));
    expect(excluirJam).toHaveBeenCalledWith("k7m2-rbq9");
    expect(push).not.toHaveBeenCalled();
  });

  it("jam que já tinha sido excluída (outra aba) também volta às jams (REL-002)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    excluirJam.mockResolvedValueOnce({ ok: false, erro: { codigo: "jam_nao_encontrada", mensagem: "Essa jam não existe ou não é sua." } });
    render(await pagina());
    fireEvent.click(screen.getByRole("button", { name: "Excluir jam" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Excluir jam" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/inicio"));
  });

  it("enquanto exclui, Cancelar fica desabilitado; o erro aparece e some ao reabrir (UX-002)", async () => {
    obterJam.mockResolvedValueOnce(jam());
    let responder!: (r: unknown) => void;
    excluirJam.mockReturnValueOnce(new Promise((r) => (responder = r)));
    render(await pagina());
    fireEvent.click(screen.getByRole("button", { name: "Excluir jam" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Excluir jam" }));
    expect(await within(dialogo).findByRole("button", { name: "Excluindo..." })).toBeDisabled();
    expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeDisabled();
    fireEvent.keyDown(dialogo, { key: "Escape" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    responder({ ok: false, erro: { codigo: "inesperado", mensagem: "Algo deu errado. Tente de novo." } });
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Algo deu errado. Tente de novo.");
    // O erro aparece um instante antes de a exclusão terminar; o Cancelar volta junto com ela.
    await waitFor(() => expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeEnabled());
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "Excluir jam" }));
    expect(within(await screen.findByRole("alertdialog")).queryByRole("alert")).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it("não usa travessão no texto", async () => {
    obterJam.mockResolvedValueOnce(jam());
    render(await pagina());
    expect(document.body.textContent).not.toContain("—");
  });
});
