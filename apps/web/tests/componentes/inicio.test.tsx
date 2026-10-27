import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const obterSessao = vi.fn(async (): Promise<{ user: { name: string } } | null> => null);
vi.mock("@/servidor/auth", () => ({ obterSessao }));

const { default: Inicio, Saudacao } = await import("@/app/(app)/inicio/page");

describe("Início vazio", () => {
  it("diz que não há jams e oferece Criar jam e Adicionar amigos", () => {
    render(<Inicio />);
    expect(screen.getByText("Você ainda não tem nenhuma jam.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar jam" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar amigos" })).toBeInTheDocument();
  });

  it("não usa travessão no texto", () => {
    const { container } = render(<Inicio />);
    expect(container.textContent).not.toContain("—");
  });

  it("cumprimenta pelo primeiro nome do GitHub", async () => {
    obterSessao.mockResolvedValueOnce({ user: { name: "Lucas de Oliveira Andrade" } });
    render(await Saudacao());
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Olá, Lucas");
  });
});
