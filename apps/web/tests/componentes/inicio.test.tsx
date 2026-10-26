import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/auth", () => ({ obterSessao: vi.fn(async () => null) }));

const { default: Inicio } = await import("@/app/(app)/inicio/page");

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
});
