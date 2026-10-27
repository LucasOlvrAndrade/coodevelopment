import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const signOut = vi.fn(async (): Promise<{ error?: unknown }> => ({}));
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("@/componentes/conta/cliente-auth", () => ({ clienteAuth: { signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, refresh }) }));

const { MenuConta } = await import("@/componentes/conta/MenuConta");

describe("menu da conta", () => {
  it("abre pelo teclado e mostra nome, usuário e Sair", async () => {
    render(<MenuConta nome="Lucas Andrade" login="LucasOlvrAndrade" />);
    const gatilho = screen.getByRole("button", { name: "Conta de Lucas Andrade" });
    gatilho.focus();
    fireEvent.keyDown(gatilho, { key: "Enter" });
    expect(await screen.findByRole("menuitem", { name: "Sair" })).toBeInTheDocument();
    expect(screen.getByText("@LucasOlvrAndrade")).toBeInTheDocument();
  });

  it("Sair encerra a sessão e volta para a página inicial", async () => {
    render(<MenuConta nome="Lucas Andrade" login="LucasOlvrAndrade" />);
    const gatilho = screen.getByRole("button", { name: "Conta de Lucas Andrade" });
    fireEvent.keyDown(gatilho, { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sair" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("se não der para sair, avisa e continua na página", async () => {
    replace.mockClear();
    signOut.mockResolvedValueOnce({ error: { status: 0 } });
    render(<MenuConta nome="Lucas Andrade" login="LucasOlvrAndrade" />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Conta de Lucas Andrade" }), { key: "Enter" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Sair" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Não deu para sair");
    expect(replace).not.toHaveBeenCalled();
  });
});
