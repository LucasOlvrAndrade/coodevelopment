# Tech Stack

Versões marcadas "atual na 1.1" são fixadas na Story 1.1, na última estável
daquele dia, e registradas aqui. Versões com número foram conferidas em
23/10/2026.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|---|---|---|---|---|
| Frontend Language | TypeScript | atual na 1.1 | Tudo, nas quatro partes | Um idioma só; tipos do protocolo compartilhados |
| Frontend Framework | Next.js (App Router) | 16.x | App web | Decisão do brief; Vercel; Server Components |
| UI Component Library | Radix UI Primitives | atual na 1.1 | Diálogo, menu, seletor acessíveis | Front-end spec: primitivos sem estilo, visual próprio |
| State Management | React (estado local) + `useSyncExternalStore` sobre a conexão da sala | React 19 | Estado ao vivo da página da jam | Só uma página tem estado ao vivo; biblioteca de estado não se paga |
| Backend Language | TypeScript em Node.js | Node 22 LTS ou mais novo | Rotas, conector, plugin | `WebSocket` nativo no Node 22; o conector exige Node (D13) |
| Backend Framework | Next.js Route Handlers e Server Actions; PartyServer na sala | atual na 1.1 | API do app e lógica da sala | Sem servidor próprio para manter |
| API Style | REST (Route Handlers) + mensagens WebSocket tipadas | n/a | Conector e sala; mutações da UI por Server Actions | REST é o que o conector consome com `fetch`; WebSocket para o tempo real |
| Database | Neon Postgres + Drizzle ORM | Postgres 17; Drizzle atual na 1.1 | Usuários, amizades, jams, participantes, fechamentos | Já usado pelo Lucas; SQL tipado |
| Cache | Nenhum | n/a | n/a | Escala de 2 ou 3 pessoas |
| File Storage | SQLite do Durable Object | n/a | Estado dos arquivos da jam, histórico e feed | Mora junto da conexão; limite de 5 GB no plano gratuito |
| Authentication | Better Auth com GitHub (via GitHub App) e plugin de device authorization | 1.7.x (1.7.12 em 20/10/2026) | Login web e login do conector por código | Auth.js está em manutenção desde 09/2025 e o time recomenda Better Auth; device flow (RFC 8628) pronto |
| Frontend Testing | Vitest + Testing Library | atual na 1.1 | Componentes e lógica de UI | Rápido, TypeScript nativo |
| Backend Testing | Vitest; `@cloudflare/vitest-pool-workers` na sala | atual na 1.1 | Protocolo, sincronização, rotas, sala | Testa o Durable Object no runtime real |
| E2E Testing | Playwright | atual na 1.1 | Login simulado, criar jam, página da jam ao vivo | Padrão do mercado; roda no Windows |
| Build Tool | pnpm workspaces | pnpm 10.x | Monorepo | Já usado pelo Lucas |
| Bundler | Turbopack (web), Wrangler/esbuild (sala), tsup (conector) | atual na 1.1 | Build de cada parte | O padrão de cada plataforma |
| IaC Tool | `wrangler.jsonc` + configuração da Vercel por CLI | atual na 1.1 | Sala e app | Infra pequena; sem Terraform |
| CI/CD | GitHub Actions + integração Git da Vercel | n/a | Testes em PR; deploy da sala e publicação do conector | Vercel já publica na `main` |
| Monitoring | Vercel Observability + Cloudflare Workers Logs | n/a | Erros e latência | Incluídos nos planos |
| Logging | `console` estruturado (JSON) nas três partes de servidor; arquivo de log rotativo no conector | n/a | Diagnóstico | Lido pelo modo de diagnóstico do conector |
| CSS Framework | Tailwind CSS com tokens em CSS | 4.x | Visual da front-end spec | Tokens claro e escuro definidos na spec |
| Realtime | PartyServer + `partysocket` (Cloudflare) | atual na 1.1 | Sala da jam e clientes | Ver Platform Choice |
| MCP | `@modelcontextprotocol/server` (SDK v2) | 2.3.x (2.3.1 em 05/10/2026) | Servidor MCP `anunciar` | Linha estável atual; a v1 só recebe correções |
| Watcher | `@parcel/watcher` | atual na 1.1 | Vigiar a pasta do projeto | Nativo (ReadDirectoryChangesW no Windows), CPU baixa parada (NFR6) |
| Merge | `node-diff3` | atual na 1.1 | Merge de três vias na sala | Pequeno e sem dependência |
| Validação | zod | 4.x | Protocolo, rotas, entradas dos hooks | Standard Schema, aceito pelo SDK MCP v2 |
