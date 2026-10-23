import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function lerJson(caminho: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(`../${caminho}`, import.meta.url), "utf8"));
}

describe("estrutura do plugin", () => {
  it("plugin.json tem o nome em kebab-case sem prefixo reservado", () => {
    const { name } = lerJson(".claude-plugin/plugin.json");
    expect(name).toBe("coodevelopment");
    expect(name).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(name).not.toMatch(/^(claude-|anthropic-)/);
  });

  it("hooks.json tem o invólucro { hooks: {...} }", () => {
    const conteudo = lerJson("hooks/hooks.json");
    expect(conteudo).toHaveProperty("hooks");
    expect(typeof conteudo.hooks).toBe("object");
  });

  it(".mcp.json tem o mapa mcpServers", () => {
    const conteudo = lerJson(".mcp.json");
    expect(conteudo).toHaveProperty("mcpServers");
  });
});
