import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/auth", () => ({ obterSessao: vi.fn(async () => null) }));
vi.mock("@/componentes/conta/cliente-auth", () => ({ clienteAuth: { signIn: { social: vi.fn() } } }));

const { default: PaginaInicial } = await import("@/app/(publico)/page");
const { AvisoErroLogin } = await import("@/componentes/conta/AvisoErroLogin");

const props = { params: Promise.resolve({}), searchParams: Promise.resolve({}) };

describe("página inicial", () => {
  it("diz em uma frase o que o produto faz", () => {
    render(<PaginaInicial {...props} />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Programe junto com seus amigos, cada um com o seu Claude Code/,
      }),
    ).toBeInTheDocument();
  });

  it("tem o botão de entrar com GitHub e explica o All repositories", () => {
    render(<PaginaInicial {...props} />);
    const botao = screen.getByRole("button", { name: "Entrar com GitHub" });
    expect(botao).toBeEnabled();
    expect(botao).toHaveAccessibleDescription(/All repositories/);
  });

  it("o botão branco do menu também entra com o GitHub", () => {
    render(<PaginaInicial {...props} />);
    const botao = screen.getByRole("button", { name: "Entrar" });
    expect(botao).toHaveAccessibleDescription(/All repositories/);
  });

  it("Como funciona leva à seção que explica os passos", () => {
    render(<PaginaInicial {...props} />);
    for (const link of screen.getAllByRole("link", { name: "Como funciona" })) {
      expect(link).toHaveAttribute("href", "#como-funciona");
    }
    const secao = screen.getByRole("region", { name: "Como funciona" });
    expect(secao).toHaveAttribute("id", "como-funciona");
    expect(within(secao).getAllByRole("listitem")).toHaveLength(3);
  });

  it("mostra o que o app precisa quando a pessoa recusa no GitHub", async () => {
    render(await AvisoErroLogin({ busca: Promise.resolve({ erro: "github" }) }));
    expect(screen.getByRole("alert")).toHaveTextContent(/precisa da sua autorização no GitHub/);
  });

  it("sem erro, não mostra aviso", async () => {
    expect(await AvisoErroLogin({ busca: Promise.resolve({}) })).toBeNull();
  });

  it("não usa travessão no texto", () => {
    const { container } = render(<PaginaInicial {...props} />);
    expect(container.textContent).not.toContain("—");
  });
});
