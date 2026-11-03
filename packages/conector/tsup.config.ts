import { cp, rm } from "node:fs/promises";
import { defineConfig } from "tsup";

// O protocolo é embutido no pacote publicado: ele não vai para o npm sozinho.
// O plugin do Claude Code vai junto em dist/plugin, de onde o conector o
// instala na pasta da jam (Story 4.1).
export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  noExternal: ["@coodevelopment/protocolo"],
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
  onSuccess: async () => {
    await rm("dist/plugin", { recursive: true, force: true });
    for (const parte of [".claude-plugin", "hooks", "scripts", ".mcp.json"]) {
      await cp(`../plugin/${parte}`, `dist/plugin/${parte}`, { recursive: true });
    }
  },
});
