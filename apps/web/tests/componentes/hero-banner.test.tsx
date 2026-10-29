import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/componentes/conta/cliente-auth", () => ({ clienteAuth: { signIn: { social: vi.fn() } } }));

const { HeroBanner } = await import("@/componentes/ui/HeroBanner");
const { BotaoEntrar } = await import("@/componentes/conta/BotaoEntrar");
const { APLICATIVOS_GRUPO_RAM } = await import("@/componentes/marca/aplicativos-grupo-ram");

// O hero sozinho: a página inteira tem componentes assíncronos de servidor, que
// no jsdom ficam suspensos e seguram as atualizações de estado.
function renderizar() {
  return render(
    <HeroBanner
      marca="coodevelopment"
      links={[
        { rotulo: "Início", href: "/", ativo: true },
        { rotulo: "Como funciona", href: "#como-funciona" },
      ]}
      acaoMenu={<BotaoEntrar variante="menu" />}
      seloRotulo="Beta"
      seloTexto="Até três pessoas"
      titulo="Programe junto,"
      tituloLinha2="cada um com o seu Claude Code"
      descricao="Descrição"
      acaoPrincipal={<BotaoEntrar />}
      acaoSecundaria={{ rotulo: "Como funciona", href: "#como-funciona" }}
      faixaTitulo="Da família de aplicativos do Grupo RAM"
      faixa={APLICATIVOS_GRUPO_RAM}
    />,
  );
}

describe("faixa de abertura", () => {
  it("o menu do celular abre pelo botão e fecha com Esc ou ao escolher um link", () => {
    renderizar();
    const botao = screen.getByRole("button", { name: "Menu" });
    expect(botao).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("navigation", { name: "Menu do celular" })).toBeNull();

    fireEvent.click(botao);
    expect(botao).toHaveAttribute("aria-expanded", "true");
    const menu = screen.getByRole("navigation", { name: "Menu do celular" });
    expect(within(menu).getByRole("link", { name: "Início" })).toHaveAttribute("aria-current", "page");
    expect(within(menu).getByRole("button", { name: "Entrar" })).toBeEnabled();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(botao).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(botao);
    fireEvent.click(within(screen.getByRole("navigation", { name: "Menu do celular" })).getByRole("link", { name: "Como funciona" }));
    expect(botao).toHaveAttribute("aria-expanded", "false");
  });

  it("lista os aplicativos do Grupo RAM uma vez só para o leitor de tela", () => {
    renderizar();
    const lista = screen.getByRole("list", { name: "Da família de aplicativos do Grupo RAM" });
    expect(within(lista).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["RAM Firewall (abre em outra aba)", "https://fw.gruporam.com.br"],
      ["Click Fone (abre em outra aba)", "https://portal.clickfone.com.br"],
      ["RAM Backup (abre em outra aba)", "https://rbc.gruporam.com.br"],
      ["RAM Talk (abre em outra aba)", "https://ramtalk.gruporam.com.br"],
      ["RAM Vision (abre em outra aba)", "https://ramvision.gruporam.com.br"],
      ["CRM (abre em outra aba)", "https://crm.gruporam.com.br"],
    ]);
    // As cópias que fecham o loop existem, mas ficam escondidas do leitor de tela.
    expect(screen.getAllByText("CRM")).toHaveLength(4);
    expect(screen.getAllByRole("link", { name: /^CRM/ })).toHaveLength(1);
  });

  it("cada app abre o próprio site em outra aba, e as cópias da faixa ficam fora do Tab", () => {
    renderizar();
    const todos = document.querySelectorAll<HTMLAnchorElement>('a[href="https://crm.gruporam.com.br"]');
    expect(todos).toHaveLength(4);
    for (const link of todos) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    expect([...todos].filter((link) => link.getAttribute("tabindex") === "-1")).toHaveLength(3);
  });

  it("a faixa em loop tem botão de pausa (WCAG 2.2.2)", () => {
    renderizar();
    const pausar = screen.getByRole("button", { name: "Pausar a faixa" });
    const trilha = screen.getByRole("list", { name: "Da família de aplicativos do Grupo RAM" }).parentElement;
    expect(pausar).toHaveAttribute("aria-pressed", "false");
    expect(trilha).toHaveAttribute("data-pausada", "false");

    fireEvent.click(pausar);
    expect(pausar).toHaveAttribute("aria-pressed", "true");
    expect(trilha).toHaveAttribute("data-pausada", "true");
  });

  it("a foto de fundo é decorativa", () => {
    const { container } = renderizar();
    const foto = container.querySelector("img");
    expect(foto).toHaveAttribute("alt", "");
  });
});
