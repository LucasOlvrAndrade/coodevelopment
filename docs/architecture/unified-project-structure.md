# Unified Project Structure

```plaintext
coodevelopment/
├── .github/workflows/
│   ├── ci.yaml                  # lint, typecheck, testes das quatro partes
│   ├── sala.yaml                # wrangler deploy na main (só se apps/sala mudou)
│   └── conector.yaml            # publica no npm quando a versão do conector muda
├── apps/
│   ├── web/                     # Next.js 16 (Vercel)
│   │   ├── src/ (ver Frontend Architecture)
│   │   ├── drizzle/             # migrations
│   │   ├── tests/
│   │   └── package.json
│   └── sala/                    # Cloudflare Worker + Durable Object
│       ├── src/
│       ├── tests/
│       ├── wrangler.jsonc
│       └── package.json
├── packages/
│   ├── protocolo/               # tipos, schemas zod, regras puras
│   │   ├── src/
│   │   └── package.json
│   ├── conector/                # CLI publicada no npm
│   │   ├── src/
│   │   │   ├── cli.ts           # entrar, diagnostico, sair
│   │   │   ├── login.ts         # device flow
│   │   │   ├── pasta.ts         # clone, conferência, divergência
│   │   │   ├── vigia.ts         # @parcel/watcher + agrupamento
│   │   │   ├── sincronizacao.ts # eco, pendências, gravação
│   │   │   ├── local.ts         # servidor HTTP para hooks e MCP
│   │   │   └── plugin.ts        # instala o plugin no Claude Code
│   │   ├── tests/               # integração com duas pastas temporárias
│   │   └── package.json
│   └── plugin/                  # plugin do Claude Code (copiado para o conector no build)
│       ├── .claude-plugin/plugin.json
│       ├── hooks/hooks.json
│       ├── .mcp.json
│       ├── scripts/             # hook.js, mcp.js
│       └── package.json
├── docs/
├── .env.example
├── package.json
├── pnpm-workspace.yaml
└── README.md
```
