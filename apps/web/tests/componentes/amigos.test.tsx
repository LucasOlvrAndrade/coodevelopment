import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resultado } from "@/servidor/erros";

const acoes = {
  buscarAmigo: vi.fn(),
  pedirAmizade: vi.fn(),
  aceitarPedido: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
  recusarPedido: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
  desfazerAmizade: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
};
vi.mock("@/servidor/acoes/amizade", () => acoes);

let caminho = "/amigos";
vi.mock("next/navigation", () => ({ usePathname: () => caminho }));

const { BuscaAmigo } = await import("@/componentes/amigos/BuscaAmigo");
const { PedidosRecebidos } = await import("@/componentes/amigos/PedidosRecebidos");
const { ListaAmigos } = await import("@/componentes/amigos/ListaAmigos");
const { Sugestoes } = await import("@/componentes/amigos/Sugestoes");
const { NavegacaoApp } = await import("@/componentes/conta/NavegacaoApp");

const PAI = { id: "pai", login: "pai-dev", nome: "Pai", foto: null };

function adiada<T>() {
  let resolver!: (valor: T) => void;
  const promessa = new Promise<T>((r) => (resolver = r));
  return { promessa, resolver };
}

async function buscar(texto: string) {
  fireEvent.change(screen.getByLabelText("Usuário do GitHub"), { target: { value: texto } });
  fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("busca de amigo (AC 1, 2 e 5)", () => {
  it("acha pelo usuário e o botão vira Pedido enviado na hora", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    const envio = adiada<Resultado<string>>();
    acoes.pedirAmizade.mockReturnValueOnce(envio.promessa);
    render(<BuscaAmigo />);

    await buscar("@pai-dev");
    expect(acoes.buscarAmigo).toHaveBeenCalledWith("@pai-dev");
    const resultado = await screen.findByRole("list", { name: "Resultado da busca" });
    expect(within(resultado).getByText("@pai-dev")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Pedir amizade a Pai" }));
    expect(screen.getByRole("button", { name: "Pedido enviado" })).toBeDisabled();
    expect(acoes.pedirAmizade).toHaveBeenCalledWith("pai");

    envio.resolver({ ok: true, dados: "pedido_enviado" });
    expect(await screen.findByText("Pedido enviado para Pai.")).toBeInTheDocument();
  });

  it("quem não tem conta: avisa que ninguém com esse usuário usa o app", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [] });
    render(<BuscaAmigo />);
    await buscar("ninguem");
    expect(await screen.findByRole("status")).toHaveTextContent("Ninguém com esse usuário usa o Coodevelopment ainda.");
  });

  it("usuário inválido mostra o erro ligado ao campo", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({
      ok: false,
      erro: { codigo: "login_invalido", mensagem: "Isso não parece um usuário do GitHub: use letras, números e hífen." },
    });
    render(<BuscaAmigo />);
    await buscar("pai dev");
    expect(await screen.findByRole("alert")).toHaveTextContent("Isso não parece um usuário do GitHub");
    expect(screen.getByLabelText("Usuário do GitHub")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Usuário do GitHub")).toHaveAccessibleDescription(/Isso não parece um usuário do GitHub/);
  });

  it("pedido cruzado: avisa que agora são amigos", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: true, dados: "amigos" });
    render(<BuscaAmigo />);
    await buscar("pai-dev");
    fireEvent.click(await screen.findByRole("button", { name: "Pedir amizade a Pai" }));
    expect(await screen.findByText("Amigo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Pai já tinha pedido amizade a você. Agora vocês são amigos.");
  });

  it("se o pedido falha, o botão volta e o erro aparece", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: false, erro: { codigo: "inesperado", mensagem: "Algo deu errado. Tente de novo." } });
    render(<BuscaAmigo />);
    await buscar("pai-dev");
    fireEvent.click(await screen.findByRole("button", { name: "Pedir amizade a Pai" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Algo deu errado. Tente de novo.");
    expect(screen.getByRole("button", { name: "Pedir amizade a Pai" })).toBeEnabled();
  });

  it("mostra a relação: eu, amigo, enviado e recebido (com aceitar ali mesmo)", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({
      ok: true,
      dados: [
        { id: "eu", login: "lucas", nome: "Lucas", foto: null, relacao: { tipo: "eu" } },
        { id: "a", login: "amiga", nome: "Amiga", foto: null, relacao: { tipo: "amigo" } },
        { id: "b", login: "enviado", nome: "Enviado", foto: null, relacao: { tipo: "pedido_enviado" } },
        { ...PAI, relacao: { tipo: "pedido_recebido", pedidoId: "p1" } },
      ],
    });
    render(<BuscaAmigo />);
    await buscar("qualquer");
    expect(await screen.findByText("É você")).toBeInTheDocument();
    expect(screen.getByText("Amigo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedido enviado" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de Pai" }));
    await waitFor(() => expect(acoes.aceitarPedido).toHaveBeenCalledWith("p1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Agora você e Pai são amigos.");
  });
});

describe("pedidos recebidos (AC 3)", () => {
  const pedidos = [{ ...PAI, pedidoId: "p1" }];

  it("aceitar e recusar chamam a ação com o id do pedido", async () => {
    render(<PedidosRecebidos pedidos={pedidos} />);
    expect(screen.getByRole("heading", { name: "Pedidos recebidos" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de Pai" }));
    await waitFor(() => expect(acoes.aceitarPedido).toHaveBeenCalledWith("p1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Agora você e Pai são amigos.");

    fireEvent.click(screen.getByRole("button", { name: "Recusar o pedido de Pai" }));
    await waitFor(() => expect(acoes.recusarPedido).toHaveBeenCalledWith("p1"));
    expect(await screen.findByText("Pedido de Pai recusado.")).toBeInTheDocument();
  });

  it("erro aparece como alerta", async () => {
    acoes.aceitarPedido.mockResolvedValueOnce({ ok: false, erro: { codigo: "pedido_nao_encontrado", mensagem: "Esse pedido não está mais pendente." } });
    render(<PedidosRecebidos pedidos={pedidos} />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de Pai" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse pedido não está mais pendente.");
  });

  it("sem pedidos, não mostra a seção", () => {
    render(<PedidosRecebidos pedidos={[]} />);
    expect(screen.queryByRole("heading", { name: "Pedidos recebidos" })).toBeNull();
  });
});

describe("lista de amigos (AC 4)", () => {
  it("sem amigos, explica como achar alguém", () => {
    render(<ListaAmigos amigos={[]} />);
    expect(screen.getByText(/Você ainda não tem amigos aqui/)).toBeInTheDocument();
  });

  it("desfazer pede confirmação; cancelar não desfaz", async () => {
    render(<ListaAmigos amigos={[PAI]} />);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer amizade com Pai" }));
    const dialogo = await screen.findByRole("alertdialog", { name: "Desfazer amizade com Pai?" });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(acoes.desfazerAmizade).not.toHaveBeenCalled();
  });

  it("confirmar desfaz e avisa", async () => {
    render(<ListaAmigos amigos={[PAI]} />);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer amizade com Pai" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desfazer amizade" }));
    await waitFor(() => expect(acoes.desfazerAmizade).toHaveBeenCalledWith("pai"));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(screen.getByRole("status")).toHaveTextContent("Você e Pai não são mais amigos.");
  });

  it("se falhar, o erro aparece no diálogo, que fica aberto", async () => {
    acoes.desfazerAmizade.mockResolvedValueOnce({ ok: false, erro: { codigo: "nao_sao_amigos", mensagem: "Vocês já não são amigos." } });
    render(<ListaAmigos amigos={[PAI]} />);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer amizade com Pai" }));
    const dialogo = await screen.findByRole("alertdialog");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Desfazer amizade" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Vocês já não são amigos.");
  });
});

describe("sugestões de mútuos (Story 1.4)", () => {
  it("cada sugestão manda o pedido e o botão vira Pedido enviado", async () => {
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: true, dados: "pedido_enviado" });
    render(<Sugestoes sugestoes={[PAI]} />);
    const lista = screen.getByRole("list", { name: "Sugestões do GitHub" });
    fireEvent.click(within(lista).getByRole("button", { name: "Pedir amizade a Pai" }));
    expect(screen.getByRole("button", { name: "Pedido enviado" })).toBeDisabled();
    await waitFor(() => expect(acoes.pedirAmizade).toHaveBeenCalledWith("pai"));
    expect(await screen.findByRole("status")).toHaveTextContent("Pedido enviado para Pai.");
  });

  it("sem mútuos no app, explica e manda para a busca", () => {
    render(<Sugestoes sugestoes={[]} />);
    expect(screen.getByText("Nenhum dos seus mútuos do GitHub usa o Coodevelopment ainda. Busque pelo usuário abaixo.")).toBeInTheDocument();
    expect(screen.queryByRole("list")).toBeNull();
  });
});

describe("navegação principal", () => {
  it("mostra o contador de pedidos recebidos em Amigos e marca a página atual", () => {
    caminho = "/amigos";
    render(<NavegacaoApp pedidosRecebidos={2} posicao="topo" />);
    const amigos = screen.getByRole("link", { name: "Amigos, 2 pedidos recebidos" });
    expect(amigos).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Jams" })).not.toHaveAttribute("aria-current");
  });

  it("sem pedidos, sem contador", () => {
    caminho = "/inicio";
    render(<NavegacaoApp pedidosRecebidos={0} posicao="baixo" />);
    expect(screen.getByRole("link", { name: "Amigos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jams" })).toHaveAttribute("aria-current", "page");
  });
});
