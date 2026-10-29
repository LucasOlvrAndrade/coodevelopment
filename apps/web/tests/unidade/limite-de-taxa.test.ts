// @vitest-environment node
import { afterAll, describe, expect, it, vi } from "vitest";
import { criarBancoDeTeste } from "../apoio/banco-teste";

// Limite de taxa do login do conector (Story 3.1, security-and-performance.md),
// como em produção: o Better Auth só liga o limite com NODE_ENV=production.

const teste = await criarBancoDeTeste();
vi.mock("@/servidor/db", () => ({ db: () => teste.banco }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.stubEnv("NODE_ENV", "production");
vi.stubEnv("DATABASE_URL", "postgres://u:s@localhost/db");
vi.stubEnv("BETTER_AUTH_SECRET", "x".repeat(32));
vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");
vi.stubEnv("GITHUB_APP_CLIENT_ID", "id");
vi.stubEnv("GITHUB_APP_CLIENT_SECRET", "segredo");
vi.stubEnv("GITHUB_APP_SLUG", "coodevelopment");

const { auth, ID_DO_CONECTOR } = await import("@/servidor/auth");

afterAll(() => teste.fechar());

function pedirCodigo(ip: string) {
  return auth().handler(
    new Request("http://localhost:3000/api/auth/device/code", {
      method: "POST",
      headers: { "content-type": "application/json", "x-vercel-forwarded-for": ip },
      body: JSON.stringify({ client_id: ID_DO_CONECTOR }),
    }),
  );
}

describe("limite de taxa do login do conector", () => {
  it("10 pedidos de código por minuto por IP; o 11º recebe 429, e outro IP segue", async () => {
    for (let i = 0; i < 10; i++) expect((await pedirCodigo("203.0.113.7")).status).toBe(200);
    const recusado = await pedirCodigo("203.0.113.7");
    expect(recusado.status).toBe(429);
    expect(Number(recusado.headers.get("x-retry-after"))).toBeGreaterThan(0);
    expect((await pedirCodigo("198.51.100.20")).status).toBe(200);
  });

  it("guarda a contagem no banco, para valer entre as instâncias da Vercel", async () => {
    const linhas = await teste.banco.query.rateLimit.findMany();
    expect(linhas.map((l) => l.key)).toEqual(expect.arrayContaining([expect.stringContaining("203.0.113.7")]));
  });
});
