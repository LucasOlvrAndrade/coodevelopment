import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const acoes = vi.hoisted(() => ({ consultarDispositivo: vi.fn(), responderDispositivo: vi.fn() }));
vi.mock("@/servidor/acoes/dispositivo", () => acoes);

const { ConfirmarDispositivo } = await import("@/componentes/conta/ConfirmarDispositivo");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("tela /dispositivo (Story 3.1, AC 1)", () => {
  it("com o código do link, mostra o código, avisa do golpe e confirma", async () => {
    acoes.responderDispositivo.mockResolvedValueOnce({ ok: true, dados: { situacao: "confirmado" } });
    render(<ConfirmarDispositivo inicial={{ tipo: "decidir", codigo: "WDJBMJHT", situacao: "pendente" }} />);
    expect(screen.getByText("WDJBMJHT")).toBeInTheDocument();
    expect(screen.getByText(/Se alguém te mandou este link, recuse/)).toBeInTheDocument();

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" })));
    expect(acoes.responderDispositivo).toHaveBeenCalledWith("WDJBMJHT", true);
    expect(await screen.findByRole("status")).toHaveTextContent("Pronto, o conector entrou na sua conta. Pode voltar para o terminal.");
    expect(screen.queryByRole("button", { name: "Confirmar" })).toBeNull();
  });

  it("recusar avisa que o conector não entrou", async () => {
    acoes.responderDispositivo.mockResolvedValueOnce({ ok: true, dados: { situacao: "recusado" } });
    render(<ConfirmarDispositivo inicial={{ tipo: "decidir", codigo: "WDJBMJHT", situacao: "pendente" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Recusar" })));
    expect(acoes.responderDispositivo).toHaveBeenCalledWith("WDJBMJHT", false);
    expect(await screen.findByRole("status")).toHaveTextContent("Recusado. O conector não entrou na sua conta.");
  });

  it("código já respondido não mostra os botões", () => {
    render(<ConfirmarDispositivo inicial={{ tipo: "decidir", codigo: "WDJBMJHT", situacao: "confirmado" }} />);
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/Pronto/);
  });

  it("sem código no link, pede o código do terminal e consulta", async () => {
    acoes.consultarDispositivo.mockResolvedValueOnce({ ok: true, dados: { codigo: "ABCDEFGH", situacao: "pendente" } });
    render(<ConfirmarDispositivo inicial={{ tipo: "digitar" }} />);
    fireEvent.change(screen.getByLabelText("Código que aparece no terminal"), { target: { value: "abcd-efgh" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continuar" })));
    expect(acoes.consultarDispositivo).toHaveBeenCalledWith("abcd-efgh");
    expect(await screen.findByText("ABCDEFGH")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeInTheDocument();
  });

  it("código errado volta para o campo, com o erro ligado a ele", async () => {
    acoes.consultarDispositivo.mockResolvedValueOnce({ ok: false, erro: { codigo: "codigo_dispositivo_invalido", mensagem: "Esse código não existe." } });
    render(<ConfirmarDispositivo inicial={{ tipo: "digitar" }} />);
    fireEvent.change(screen.getByLabelText("Código que aparece no terminal"), { target: { value: "ZZZZ" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continuar" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse código não existe.");
    expect(screen.getByLabelText("Código que aparece no terminal")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Código que aparece no terminal")).toHaveAccessibleDescription("Esse código não existe.");
  });

  it("erro vindo do link (código vencido) aparece no campo", () => {
    render(<ConfirmarDispositivo inicial={{ tipo: "digitar", erro: "Esse código venceu." }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Esse código venceu.");
  });

  it("depois de um erro, o foco volta para o campo ou para o Confirmar (gate da 3.1, A11Y-001)", async () => {
    acoes.consultarDispositivo.mockResolvedValueOnce({ ok: false, erro: { codigo: "codigo_dispositivo_invalido", mensagem: "Esse código não existe." } });
    const { unmount } = render(<ConfirmarDispositivo inicial={{ tipo: "digitar" }} />);
    fireEvent.change(screen.getByLabelText("Código que aparece no terminal"), { target: { value: "ZZZZ" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Continuar" })));
    await vi.waitFor(() => expect(screen.getByLabelText("Código que aparece no terminal")).toHaveFocus());
    unmount();

    acoes.responderDispositivo.mockResolvedValueOnce({ ok: false, erro: { codigo: "codigo_dispositivo_respondido", mensagem: "Esse código já foi respondido." } });
    render(<ConfirmarDispositivo inicial={{ tipo: "decidir", codigo: "WDJBMJHT", situacao: "pendente" }} />);
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Confirmar" })));
    expect(await screen.findByRole("alert")).toHaveTextContent("Esse código já foi respondido.");
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Confirmar" })).toHaveFocus());
  });
});
