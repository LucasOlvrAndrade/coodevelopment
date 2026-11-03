import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/site-do-projeto", () => ({ siteDoProjeto: vi.fn() }));
const { ColunaDoSite } = await import("@/componentes/jams/SiteDoProjeto");

// A coluna do site do projeto na página da jam (pedido do Lucas, 03/11).

describe("ColunaDoSite", () => {
  it("com o site que deixa embutir: link em outra aba e a prévia", () => {
    render(<ColunaDoSite site={{ url: "https://meu-app.vercel.app/", embutir: true }} repositorio="lucas/app" />);
    const link = screen.getByRole("link", { name: /meu-app\.vercel\.app/ });
    expect(link).toHaveAttribute("href", "https://meu-app.vercel.app/");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveAccessibleName(/abre em outra aba/);
    const previa = screen.getByTitle("Prévia do site do projeto");
    expect(previa).toHaveAttribute("src", "https://meu-app.vercel.app/");
    expect(previa.getAttribute("sandbox")).not.toContain("allow-top-navigation");
  });

  it("site que não deixa embutir: só o link, com o motivo", () => {
    render(<ColunaDoSite site={{ url: "https://github.com/", embutir: false }} repositorio="lucas/app" />);
    expect(screen.queryByTitle("Prévia do site do projeto")).toBeNull();
    expect(screen.getByText(/não deixa aparecer dentro de outra página/)).toBeInTheDocument();
  });

  it("sem site: explica onde pôr o endereço no GitHub", () => {
    render(<ColunaDoSite site={null} repositorio="lucas/app" />);
    expect(screen.getByText("O repositório ainda não tem site.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "página do repositório no GitHub" })).toHaveAttribute("href", "https://github.com/lucas/app");
  });
});
