import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComoFunciona } from "@/componentes/marca/ComoFunciona";

const PASSOS = [
  { titulo: "Primeiro", texto: "Texto do primeiro." },
  { titulo: "Segundo", texto: "Texto do segundo." },
  { titulo: "Terceiro", texto: "Texto do terceiro." },
];

function quadrado(nome: RegExp) {
  return screen.getByRole("button", { name: nome });
}

describe("ComoFunciona", () => {
  it("começa com os três quadrados do logo recolhidos", () => {
    render(<ComoFunciona passos={PASSOS} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
    for (const botao of screen.getAllByRole("button")) expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Texto do primeiro.").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "true");
  });

  it("o mouse sobre um quadrado abre o bloco dele, e os outros ficam no logo", () => {
    render(<ComoFunciona passos={PASSOS} />);
    fireEvent.pointerEnter(quadrado(/02\. Segundo/), { pointerType: "mouse" });
    expect(quadrado(/02\. Segundo/)).toHaveAttribute("aria-expanded", "true");
    expect(quadrado(/01\. Primeiro/)).toHaveAttribute("aria-expanded", "false");
    expect(quadrado(/03\. Terceiro/)).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Texto do segundo.").closest("[aria-hidden]")).toHaveAttribute("aria-hidden", "false");
    expect(quadrado(/02\. Segundo/)).toHaveStyle({ opacity: "0" });
    expect(quadrado(/01\. Primeiro/)).toHaveStyle({ opacity: "1" });
  });

  it("no toque, o foco e o clique chegam juntos e o bloco fica aberto; tocar em outro troca", () => {
    render(<ComoFunciona passos={PASSOS} />);
    fireEvent.focus(quadrado(/03\. Terceiro/));
    fireEvent.click(quadrado(/03\. Terceiro/));
    expect(quadrado(/03\. Terceiro/)).toHaveAttribute("aria-expanded", "true");
    fireEvent.focus(quadrado(/01\. Primeiro/));
    fireEvent.click(quadrado(/01\. Primeiro/));
    expect(quadrado(/01\. Primeiro/)).toHaveAttribute("aria-expanded", "true");
    expect(quadrado(/03\. Terceiro/)).toHaveAttribute("aria-expanded", "false");
  });

  it("pelo teclado, o foco abre o quadrado", () => {
    render(<ComoFunciona passos={PASSOS} />);
    fireEvent.focus(quadrado(/01\. Primeiro/));
    expect(quadrado(/01\. Primeiro/)).toHaveAttribute("aria-expanded", "true");
  });
});
