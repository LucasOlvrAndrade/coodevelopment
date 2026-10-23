import { defineConfig } from "tsup";

// O protocolo é embutido no pacote publicado: ele não vai para o npm sozinho.
export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  noExternal: ["@coodevelopment/protocolo"],
  banner: { js: "#!/usr/bin/env node" },
  clean: true,
});
