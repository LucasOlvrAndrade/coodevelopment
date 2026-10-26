import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "@/componentes/ui/Avatar";

describe("Avatar", () => {
  it("mostra a foto do GitHub como imagem decorativa", () => {
    const { container } = render(<Avatar nome="Lucas Andrade" foto="https://avatars.githubusercontent.com/u/1" />);
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("alt", "");
  });

  it("sem foto, mostra as iniciais do primeiro e do último nome", () => {
    render(<Avatar nome="Lucas de Oliveira Andrade" />);
    expect(screen.getByText("LA")).toBeInTheDocument();
  });

  it("nome de uma palavra vira uma inicial", () => {
    render(<Avatar nome="octocat" />);
    expect(screen.getByText("O")).toBeInTheDocument();
  });
});
