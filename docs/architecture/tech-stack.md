# Tech Stack

Versões fixadas na Story 1.1 em 26/10/2026: o número exato é o que está no
`pnpm-lock.yaml`. Itens que a 1.1 ainda não instala aparecem com "fixar ao
instalar" e a última estável do dia, só como referência; a story que os
trouxer fixa a versão e atualiza esta tabela. Licenças conferidas no npm em
26/10/2026: todas MIT ou Apache 2.0, menos o PartyServer, que é ISC
(permissiva, equivalente à MIT). Better Auth e o SDK MCP foram conferidos em
outubro e entram nas Stories 1.2 e 4.x.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|---|---|---|---|---|
| Frontend Language | TypeScript | 6.0.3 (Apache-2.0) | Tudo, nas quatro partes | Um idioma só; tipos do protocolo compartilhados |
| Frontend Framework | Next.js (App Router) | 16.4.3 (MIT) | App web | Decisão do brief; Vercel; Server Components |
| UI Component Library | Radix UI Primitives (pacote `radix-ui`) | 1.8.1 (MIT) | Diálogo, menu, seletor acessíveis | Front-end spec: primitivos sem estilo, visual próprio |
| State Management | React (estado local) + `useSyncExternalStore` sobre a conexão da sala | React 19.3.0 (MIT) | Estado ao vivo da página da jam | Só uma página tem estado ao vivo; biblioteca de estado não se paga |
| Backend Language | TypeScript em Node.js | Node 22 LTS ou mais novo | Rotas, conector, plugin | `WebSocket` nativo no Node 22; o conector exige Node (D13) |
| Backend Framework | Next.js Route Handlers e Server Actions; PartyServer na sala | Next.js 16.4.3; PartyServer 0.5.10 (ISC) | API do app e lógica da sala | Sem servidor próprio para manter |
| API Style | REST (Route Handlers) + mensagens WebSocket tipadas | n/a | Conector e sala; mutações da UI por Server Actions | REST é o que o conector consome com `fetch`; WebSocket para o tempo real |
| Database | Neon Postgres + Drizzle ORM | Postgres 17; `drizzle-orm` 0.45.4 (Apache-2.0), `drizzle-kit` 0.31.11 (MIT), `@neondatabase/serverless` 1.2.0 (MIT) | Usuários, amizades, jams, participantes, fechamentos | Já usado pelo Lucas; SQL tipado |
| Cache | Nenhum | n/a | n/a | Escala de 2 ou 3 pessoas |
| File Storage | SQLite do Durable Object | n/a | Estado dos arquivos da jam, histórico e feed | Mora junto da conexão; limite de 5 GB no plano gratuito |
| Authentication | Better Auth com GitHub (via GitHub App) e plugin de device authorization | 1.7.13 (MIT) | Login web e login do conector por código | Auth.js está em manutenção desde 09/2025 e o time recomenda Better Auth; device flow (RFC 8628) pronto |
| GitHub API | `@octokit/rest` | 22.0.1 (MIT) | Chamadas ao GitHub em nome do usuário | Hook antes de cada chamada busca o token pelo Better Auth, que renova o vencido (Story 1.2) |
| Frontend Testing | Vitest + Testing Library | Vitest 4.1.12, `@testing-library/react` 16.3.3 (MIT) | Componentes e lógica de UI | Rápido, TypeScript nativo |
| Backend Testing | Vitest; `@cloudflare/vitest-plugin` na sala (o antigo `vitest-pool-workers`, renomeado) | Vitest 4.1.12, `@cloudflare/vitest-plugin` 1.4.7 (MIT) | Protocolo, sincronização, rotas, sala | Testa o Durable Object no runtime real |
| Database Testing | PGlite (`@electric-sql/pglite`), Postgres em WASM, com o migrador do Drizzle | 0.5.9 (Apache-2.0), só nos testes | Regras do app contra Postgres de verdade, com as migrações de `apps/web/drizzle` (Story 1.3) | Testa checks, unique e CTEs sem tocar no Neon e sem branch de teste |
| E2E Testing | Playwright (`@playwright/test`) | `@playwright/test` 1.64.1 (Apache-2.0); `@axe-core/playwright` 4.14.0 (MPL-2.0, só nos testes, não vai para o app) | Login simulado, criar jam, página da jam ao vivo | Padrão do mercado; roda no Windows |
| Build Tool | pnpm workspaces | pnpm 10.34.7 (MIT) | Monorepo | Já usado pelo Lucas |
| Bundler | Turbopack (web), Wrangler/esbuild (sala), tsup (conector) | Turbopack do Next.js 16.4.3; Wrangler 4.152.0 (MIT ou Apache-2.0); tsup 8.5.1 (MIT) | Build de cada parte | O padrão de cada plataforma |
| IaC Tool | `wrangler.jsonc` + configuração da Vercel por CLI | Wrangler 4.152.0; Vercel CLI pelo `npx` (65.2.0 em 26/10/2026) | Sala e app | Infra pequena; sem Terraform |
| CI/CD | GitHub Actions + integração Git da Vercel | n/a | Testes em PR; deploy da sala e publicação do conector | Vercel já publica na `main` |
| Monitoring | Vercel Observability + Cloudflare Workers Logs | n/a | Erros e latência | Incluídos nos planos |
| Logging | `console` estruturado (JSON) nas três partes de servidor; arquivo de log rotativo no conector | n/a | Diagnóstico | Lido pelo modo de diagnóstico do conector |
| CSS Framework | Tailwind CSS com tokens em CSS | 4.3.3 (MIT) | Visual da front-end spec | Tokens claro e escuro definidos na spec |
| Realtime | PartyServer + `partysocket` (Cloudflare) | PartyServer 0.5.10 (ISC); `partysocket` fixar ao instalar, 1.3.0 em 26/10/2026 (MIT) | Sala da jam e clientes | Ver Platform Choice |
| MCP | `@modelcontextprotocol/server` (SDK v2) | 2.3.x (2.3.1 em 05/10/2026) | Servidor MCP `anunciar` | Linha estável atual; a v1 só recebe correções |
| Watcher | `@parcel/watcher` | fixar ao instalar; 2.6.0 em 26/10/2026 (MIT) | Vigiar a pasta do projeto | Nativo (ReadDirectoryChangesW no Windows), CPU baixa parada (NFR6) |
| Merge | `node-diff3` | fixar ao instalar; 3.2.1 em 26/10/2026 (MIT) | Merge de três vias na sala | Pequeno e sem dependência |
| Validação | zod | 4.6.7 (MIT) | Protocolo, rotas, entradas dos hooks | Standard Schema, aceito pelo SDK MCP v2 |
