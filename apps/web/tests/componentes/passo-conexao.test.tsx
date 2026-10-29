import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// A presença vem da sala; aqui ela é um valor que o teste troca.
const presenca = vi.hoisted(() => ({ conectado: false }));
vi.mock("@/componentes/jams/PresencaDaJam", () => ({ useConectado: () => presenca.conectado }));

const { PassoConexao, PROMPT_DO_NODE } = await import("@/componentes/jams/PassoConexao");

const escrever = vi.fn<(texto: string) => Promise<void>>();

beforeEach(() => {
  presenca.conectado = false;
  localStorage.clear();
  escrever.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText: escrever }, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
});

const passo = () => <PassoConexao jamId="k7m2-rbq9" eu="lucas" />;

describe("passo de conexão (Story 3.2)", () => {
  it("sem conector, mostra que a jam precisa do Node e o pedido para o Claude Code (AC 1 e 2)", async () => {
    render(passo());
    expect(screen.getByRole("heading", { name: "Ligue este computador à jam" })).toBeInTheDocument();
    expect(screen.getByText(/esta jam precisa do Node\.js/)).toBeInTheDocument();
    expect(screen.getByLabelText("Pedido para o Claude Code instalar o Node e o Git")).toHaveTextContent(PROMPT_DO_NODE);
    expect(PROMPT_DO_NODE).toMatch(/winget install OpenJS\.NodeJS\.LTS/);
    expect(PROMPT_DO_NODE).toMatch(/git --version/);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Copiar Pedido para o Claude Code/ })));
    expect(escrever).toHaveBeenCalledWith(PROMPT_DO_NODE);
  });

  it("\"Já instalei\" mostra o comando de entrar com o id da jam, e fica lembrado no navegador (AC 3)", async () => {
    const { unmount } = render(passo());
    fireEvent.click(screen.getByRole("button", { name: "Já instalei" }));
    expect(screen.getByLabelText("Comando para entrar na jam")).toHaveTextContent("npx coodevelopment entrar k7m2-rbq9");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Copiar Comando para entrar na jam/ })));
    expect(escrever).toHaveBeenCalledWith("npx coodevelopment entrar k7m2-rbq9");
    unmount();

    // Outra jam, mesmo computador: já começa no comando.
    render(<PassoConexao jamId="abcd-efgh" eu="lucas" />);
    expect(screen.getByLabelText("Comando para entrar na jam")).toHaveTextContent("npx coodevelopment entrar abcd-efgh");
    fireEvent.click(screen.getByRole("button", { name: "Ainda não tenho o Node" }));
    expect(screen.getByText(/esta jam precisa do Node\.js/)).toBeInTheDocument();
  });

  it("some quando o conector conecta; volta só depois de 10 s fora, sem piscar numa reconexão rápida (AC 4)", () => {
    vi.useFakeTimers();
    const { rerender } = render(passo());
    expect(screen.getByRole("heading", { name: "Ligue este computador à jam" })).toBeInTheDocument();

    presenca.conectado = true;
    rerender(passo());
    expect(screen.queryByRole("region")).toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();

    // Caiu e voltou em 3 s: nada aparece.
    presenca.conectado = false;
    rerender(passo());
    act(() => vi.advanceTimersByTime(3000));
    expect(screen.queryByRole("heading")).toBeNull();
    presenca.conectado = true;
    rerender(passo());
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.queryByRole("heading")).toBeNull();

    // Caiu e ficou fora: o passo volta depois de 10 s.
    presenca.conectado = false;
    rerender(passo());
    act(() => vi.advanceTimersByTime(9_999));
    expect(screen.queryByRole("heading")).toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole("heading", { name: "Seu conector desligou" })).toBeInTheDocument();
  });

  it("sem conectar em 2 minutos no passo do comando, aparecem as dicas (AC 5)", () => {
    vi.useFakeTimers();
    localStorage.setItem("coodevelopment:ja-instalei", "sim");
    render(passo());
    expect(screen.getByText(/Aguardando o conector/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(119_000));
    expect(screen.queryByText("Ainda não conectou?")).toBeNull();
    act(() => vi.advanceTimersByTime(1_000));
    expect(screen.getByText("Ainda não conectou?")).toBeInTheDocument();
    expect(screen.getByText("npx coodevelopment diagnostico")).toBeInTheDocument();
  });

  it("sem armazenamento no navegador, \"Já instalei\" vale até recarregar", () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("bloqueado");
    };
    try {
      render(passo());
      fireEvent.click(screen.getByRole("button", { name: "Já instalei" }));
      expect(screen.getByLabelText("Comando para entrar na jam")).toBeInTheDocument();
    } finally {
      Storage.prototype.setItem = original;
    }
  });
});

describe("bloco de copiar", () => {
  it("\"Copiado\" por 2 s, anunciado; falha avisa para copiar com Ctrl+C", async () => {
    vi.useFakeTimers();
    localStorage.setItem("coodevelopment:ja-instalei", "sim");
    render(passo());
    const botao = screen.getByRole("button", { name: /Copiar Comando/ });
    await act(async () => fireEvent.click(botao));
    expect(botao).toHaveTextContent("Copiado");
    expect(screen.getByText("Copiado para a área de transferência.")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    expect(botao).toHaveTextContent(/^Copiar/);

    escrever.mockRejectedValueOnce(new Error("sem permissão"));
    await act(async () => fireEvent.click(botao));
    expect(screen.getByText("Não deu para copiar. Selecione o texto e copie com Ctrl+C.")).toBeInTheDocument();
  });
});
