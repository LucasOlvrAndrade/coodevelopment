import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Resultado } from "@/servidor/erros";

const acoes = {
  buscarAmigo: vi.fn(),
  pedirAmizade: vi.fn(),
  aceitarPedido: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
  recusarPedido: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
  desfazerAmizade: vi.fn(async (): Promise<Resultado<void>> => ({ ok: true, dados: undefined })),
  contarMeusPedidos: vi.fn(async (): Promise<Resultado<number>> => ({ ok: true, dados: 0 })),
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
    render(<BuscaAmigo versao="v1" />);

    await buscar("@pai-dev");
    expect(acoes.buscarAmigo).toHaveBeenCalledWith("@pai-dev");
    const resultado = await screen.findByRole("list", { name: "Resultado da busca" });
    expect(within(resultado).getByText("@pai-dev")).toBeInTheDocument();

    // O mesmo botão muda de estado e o foco fica nele (gate da 1.3, A11Y-002).
    const botao = screen.getByRole("button", { name: "Pedir amizade a Pai" });
    botao.focus();
    fireEvent.click(botao);
    expect(botao).toHaveAccessibleName("Pedido enviado");
    expect(botao).toHaveAttribute("aria-disabled", "true");
    expect(botao).toHaveFocus();
    expect(acoes.pedirAmizade).toHaveBeenCalledWith("pai");

    envio.resolver({ ok: true, dados: "pedido_enviado" });
    expect(await screen.findByText("Pedido enviado para Pai.")).toBeInTheDocument();
  });

  it("quem não tem conta: avisa que ninguém com esse usuário usa o app", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [] });
    render(<BuscaAmigo versao="v1" />);
    await buscar("ninguem");
    expect(await screen.findByRole("status")).toHaveTextContent("Ninguém com esse usuário usa o Coodevelopment ainda.");
  });

  it("usuário inválido mostra o erro ligado ao campo", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({
      ok: false,
      erro: { codigo: "login_invalido", mensagem: "Isso não parece um usuário do GitHub: use letras, números e hífen." },
    });
    render(<BuscaAmigo versao="v1" />);
    await buscar("pai dev");
    expect(await screen.findByRole("alert")).toHaveTextContent("Isso não parece um usuário do GitHub");
    expect(screen.getByLabelText("Usuário do GitHub")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Usuário do GitHub")).toHaveAccessibleDescription(/Isso não parece um usuário do GitHub/);
  });

  it("pedido cruzado: avisa que agora são amigos", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: true, dados: "amigos" });
    render(<BuscaAmigo versao="v1" />);
    await buscar("pai-dev");
    fireEvent.click(await screen.findByRole("button", { name: "Pedir amizade a Pai" }));
    expect(await screen.findByText("Amigo")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Pai já tinha pedido amizade a você. Agora vocês são amigos.");
  });

  it("se o pedido falha, o botão volta e o erro aparece", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: false, erro: { codigo: "inesperado", mensagem: "Algo deu errado. Tente de novo." } });
    render(<BuscaAmigo versao="v1" />);
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
    render(<BuscaAmigo versao="v1" />);
    await buscar("qualquer");
    expect(await screen.findByText("É você")).toBeInTheDocument();
    expect(screen.getByText("Amigo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pedido enviado" })).toHaveAttribute("aria-disabled", "true");
    // O nome acessível contém o texto visível (WCAG 2.5.3, A11Y-001).
    fireEvent.click(screen.getByRole("button", { name: "Aceitar pedido de Pai" }));
    await waitFor(() => expect(acoes.aceitarPedido).toHaveBeenCalledWith("p1"));
    expect(await screen.findByRole("status")).toHaveTextContent("Agora você e Pai são amigos.");
  });
});

describe("busca depois que os dados mudam (gate da 1.3, REL-001)", () => {
  it("depois de um pedido recusado, buscar de novo deixa pedir outra vez", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    acoes.pedirAmizade.mockResolvedValueOnce({ ok: true, dados: "pedido_enviado" });
    render(<BuscaAmigo versao="v1" />);
    await buscar("pai-dev");
    fireEvent.click(await screen.findByRole("button", { name: "Pedir amizade a Pai" }));
    await screen.findByText("Pedido enviado para Pai.");

    // O Pai recusou em outro computador; a busca nova volta sem relação.
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    await buscar("pai-dev");
    const botao = await screen.findByRole("button", { name: "Pedir amizade a Pai" });
    expect(botao).not.toHaveAttribute("aria-disabled");
  });

  it("quando a página muda, a última busca é refeita e a relação atualiza", async () => {
    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "nenhuma" } }] });
    const { rerender } = render(<BuscaAmigo versao="v1" />);
    await buscar("pai-dev");
    await screen.findByRole("button", { name: "Pedir amizade a Pai" });

    acoes.buscarAmigo.mockResolvedValueOnce({ ok: true, dados: [{ ...PAI, relacao: { tipo: "pedido_recebido", pedidoId: "p9" } }] });
    rerender(<BuscaAmigo versao="v2" />);
    expect(await screen.findByRole("button", { name: "Aceitar pedido de Pai" })).toBeEnabled();
    expect(acoes.buscarAmigo).toHaveBeenLastCalledWith("pai-dev");
  });

  it("sem busca feita, a mudança de versão não busca nada", () => {
    const { rerender } = render(<BuscaAmigo versao="v1" />);
    rerender(<BuscaAmigo versao="v2" />);
    expect(acoes.buscarAmigo).not.toHaveBeenCalled();
  });
});

describe("pedidos recebidos (AC 3)", () => {
  it("responder a um pedido não libera os botões do outro em andamento (REL-002)", async () => {
    const primeiro = adiada<Resultado<void>>();
    acoes.aceitarPedido.mockReturnValueOnce(primeiro.promessa);
    const segundo = adiada<Resultado<void>>();
    acoes.aceitarPedido.mockReturnValueOnce(segundo.promessa);
    render(<PedidosRecebidos pedidos={[{ ...PAI, pedidoId: "p1" }, { id: "ana", login: "ana", nome: "Ana", foto: null, pedidoId: "p2" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de Pai" }));
    fireEvent.click(screen.getByRole("button", { name: "Aceitar o pedido de Ana" }));
    segundo.resolver({ ok: true, dados: undefined });
    await screen.findByText("Agora você e Ana são amigos.");
    expect(screen.getByRole("button", { name: "Aceitar o pedido de Pai" })).toBeDisabled();
    primeiro.resolver({ ok: true, dados: undefined });
  });

  it("quando o pedido respondido sai da lista, o foco vai para o aviso (A11Y-002)", async () => {
    const { rerender } = render(<PedidosRecebidos pedidos={[{ ...PAI, pedidoId: "p1" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "Recusar o pedido de Pai" }));
    await screen.findByText("Pedido de Pai recusado.");
    rerender(<PedidosRecebidos pedidos={[]} />);
    expect(screen.getByRole("status")).toHaveFocus();
  });

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

  it("quando o amigo sai da lista, o foco vai para o aviso (A11Y-002)", async () => {
    const { rerender } = render(<ListaAmigos amigos={[PAI]} />);
    fireEvent.click(screen.getByRole("button", { name: "Desfazer amizade com Pai" }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Desfazer amizade" }));
    await waitFor(() => expect(acoes.desfazerAmizade).toHaveBeenCalled());
    await screen.findByText("Você e Pai não são mais amigos.");
    rerender(<ListaAmigos amigos={[]} />);
    await waitFor(() => expect(screen.getByRole("status")).toHaveFocus());
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
    expect(screen.getByRole("button", { name: "Pedido enviado" })).toHaveAttribute("aria-disabled", "true");
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

  it("ao trocar de página, pede a contagem de novo (REL-003)", async () => {
    caminho = "/inicio";
    acoes.contarMeusPedidos.mockResolvedValueOnce({ ok: true, dados: 3 });
    const { rerender } = render(<NavegacaoApp pedidosRecebidos={0} posicao="topo" />);
    expect(acoes.contarMeusPedidos).not.toHaveBeenCalled();
    caminho = "/amigos";
    rerender(<NavegacaoApp pedidosRecebidos={0} posicao="topo" />);
    expect(await screen.findByRole("link", { name: "Amigos, 3 pedidos recebidos" })).toBeInTheDocument();
  });

  it("sem pedidos, sem contador", () => {
    caminho = "/inicio";
    render(<NavegacaoApp pedidosRecebidos={0} posicao="baixo" />);
    expect(screen.getByRole("link", { name: "Amigos" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jams" })).toHaveAttribute("aria-current", "page");
  });
});
