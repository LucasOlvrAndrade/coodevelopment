import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PaginaInicial from "@/app/(publico)/page";

describe("página inicial", () => {
  it("diz em uma frase o que o produto faz", () => {
    render(<PaginaInicial />);
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Programe junto com seus amigos, cada um com o seu Claude Code/,
      }),
    ).toBeInTheDocument();
  });

  it("tem o botão de entrar com GitHub", () => {
    render(<PaginaInicial />);
    expect(screen.getByRole("button", { name: "Entrar com GitHub" })).toBeInTheDocument();
  });

  it("não usa travessão no texto", () => {
    const { container } = render(<PaginaInicial />);
    expect(container.textContent).not.toContain("—");
  });
});
