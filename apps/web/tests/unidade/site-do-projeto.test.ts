import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/github", () => ({ githubDoUsuario: vi.fn() }));
const { permiteEmbutir, urlDoSite } = await import("@/servidor/site-do-projeto");

// Site do projeto na página da jam (pedido do Lucas, 03/11).

describe("urlDoSite", () => {
  it("aceita o Website do GitHub com ou sem esquema", () => {
    expect(urlDoSite("https://meu-app.vercel.app")).toBe("https://meu-app.vercel.app/");
    expect(urlDoSite("  meu-app.vercel.app/painel ")).toBe("https://meu-app.vercel.app/painel");
    expect(urlDoSite("http://exemplo.com.br")).toBe("http://exemplo.com.br/");
  });

  it("recusa vazio, outros esquemas, nome sem domínio e usuário na URL", () => {
    for (const ruim of [null, undefined, "", "   ", "javascript:alert(1)", "file:///C:/x", "localhost:3000", "https://usuario:senha@exemplo.com", "não é url"]) {
      expect(urlDoSite(ruim)).toBeNull();
    }
  });
});

describe("permiteEmbutir", () => {
  const com = (cabecalhos: Record<string, string>) => permiteEmbutir(new Headers(cabecalhos));

  it("sem restrição, embute", () => {
    expect(com({})).toBe(true);
    expect(com({ "content-security-policy": "default-src 'self'" })).toBe(true);
  });

  it("X-Frame-Options e frame-ancestors que não incluem o app não embutem", () => {
    expect(com({ "x-frame-options": "DENY" })).toBe(false);
    expect(com({ "x-frame-options": "sameorigin" })).toBe(false);
    expect(com({ "content-security-policy": "default-src 'self'; frame-ancestors 'none'" })).toBe(false);
    expect(com({ "content-security-policy": "frame-ancestors 'self' https://outro.com" })).toBe(false);
  });

  it("frame-ancestors que inclui o app, qualquer https ou o domínio pai embute", () => {
    expect(com({ "content-security-policy": "frame-ancestors https://coodevelopment.lucas-andrade.dev" })).toBe(true);
    expect(com({ "content-security-policy": "frame-ancestors *" })).toBe(true);
    expect(com({ "content-security-policy": "frame-ancestors https:" })).toBe(true);
    expect(com({ "content-security-policy": "frame-ancestors https://*.lucas-andrade.dev" })).toBe(true);
  });
});
