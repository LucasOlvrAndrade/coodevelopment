import { describe, expect, it, vi } from "vitest";

vi.mock("@/servidor/github", () => ({ githubDoUsuario: vi.fn() }));
const { conferirEmbutir, ipPublico, permiteEmbutir } = await import("@/servidor/site-do-projeto");

// A busca do site do projeto no servidor (gate da 4.1, SEC-001, SEC-002 e UX-001).

const publico = async () => [{ address: "93.184.216.34" }];

function resposta(status: number, cabecalhos: Record<string, string> = {}) {
  return new Response(status >= 300 && status < 400 ? null : "ok", { status, headers: cabecalhos });
}

describe("ipPublico", () => {
  it("recusa rede interna, loopback, link-local e reservados", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.0.10", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"]) {
      expect(ipPublico(ip), ip).toBe(false);
    }
    for (const ip of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700::1111"]) expect(ipPublico(ip), ip).toBe(true);
  });
});

describe("conferirEmbutir", () => {
  it("site público em https que deixa: embute", async () => {
    const buscar = vi.fn(async () => resposta(200));
    expect(await conferirEmbutir("https://meu-app.vercel.app/", publico, buscar as unknown as typeof fetch)).toBe(true);
    expect(buscar).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "manual" }));
  });

  it("http, IP no endereço, porta fora da padrão ou nome que aponta para a rede interna: nem busca", async () => {
    const buscar = vi.fn(async () => resposta(200));
    const b = buscar as unknown as typeof fetch;
    expect(await conferirEmbutir("http://meu-app.com/", publico, b)).toBe(false);
    expect(await conferirEmbutir("https://127.0.0.1/", publico, b)).toBe(false);
    expect(await conferirEmbutir("https://meu-app.com:8443/", publico, b)).toBe(false);
    expect(await conferirEmbutir("https://interno.exemplo.com/", async () => [{ address: "10.0.0.5" }], b)).toBe(false);
    expect(await conferirEmbutir("https://sem-dns.exemplo.com/", async () => [], b)).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it("redirecionamento é conferido a cada salto: para a rede interna, para", async () => {
    const buscar = vi.fn(async (url: URL) => (url.hostname === "fora.com" ? resposta(302, { location: "https://dentro.com/admin" }) : resposta(200)));
    const resolver = async (nome: string) => [{ address: nome === "dentro.com" ? "192.168.1.1" : "93.184.216.34" }];
    expect(await conferirEmbutir("https://fora.com/", resolver, buscar as unknown as typeof fetch)).toBe(false);
    expect(buscar).toHaveBeenCalledTimes(1);
  });

  it("redirecionamento para outro site público segue; laço para depois de 3 saltos", async () => {
    const segue = vi.fn(async (url: URL) => (url.hostname === "a.com" ? resposta(301, { location: "https://b.com/" }) : resposta(200)));
    expect(await conferirEmbutir("https://a.com/", publico, segue as unknown as typeof fetch)).toBe(true);
    const laco = vi.fn(async () => resposta(302, { location: "https://a.com/" }));
    expect(await conferirEmbutir("https://a.com/", publico, laco as unknown as typeof fetch)).toBe(false);
    expect(laco).toHaveBeenCalledTimes(4);
  });

  it("redirecionamento com endereço inválido: só o link, sem erro (gate da 4.1, UX-003)", async () => {
    const quebrado = vi.fn(async () => resposta(302, { location: "http://[::1" }));
    expect(await conferirEmbutir("https://a.com/", publico, quebrado as unknown as typeof fetch)).toBe(false);
  });

  it("site fora do ar ou com erro: só o link", async () => {
    expect(await conferirEmbutir("https://a.com/", publico, (async () => resposta(500)) as unknown as typeof fetch)).toBe(false);
    expect(await conferirEmbutir("https://a.com/", publico, (async () => Promise.reject(new Error("rede"))) as unknown as typeof fetch)).toBe(false);
  });
});

describe("permiteEmbutir com cabeçalhos repetidos (SEC-002)", () => {
  it("X-Frame-Options repetido e várias CSP juntadas por vírgula", () => {
    const h = new Headers();
    h.append("x-frame-options", "DENY");
    h.append("x-frame-options", "DENY");
    expect(permiteEmbutir(h)).toBe(false);
    const csp = new Headers();
    csp.append("content-security-policy", "default-src 'self'");
    csp.append("content-security-policy", "frame-ancestors 'none'");
    expect(permiteEmbutir(csp)).toBe(false);
  });
});
