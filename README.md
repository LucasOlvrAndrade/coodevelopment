# Coodevelopment

Programe junto com seus amigos, cada um com o seu Claude Code, vendo ao vivo
o que cada Claude está fazendo. Até três pessoas por jam, uma jam por
repositório do GitHub.

No ar em https://coodevelopment.lucas-andrade.dev

## Partes

| Pasta | O que é |
|---|---|
| `apps/web` | App Next.js 16 na Vercel: login, amigos, jams, commit |
| `apps/sala` | Sala de tempo real de cada jam (Cloudflare Durable Object) |
| `packages/conector` | CLI `npx coodevelopment`, que liga o PC à jam |
| `packages/plugin` | Plugin do Claude Code (hooks e ferramenta `anunciar`) |
| `packages/protocolo` | Tipos e regras compartilhados pelas outras partes |

## Rodar

Requisitos: Node 22 ou mais novo e pnpm 10 (`corepack enable` ou
`npx pnpm@10`).

```bash
pnpm install
vercel env pull apps/web/.env.local   # segredos nunca vão para o git
pnpm dev                              # web em :3000 e sala em :1999
pnpm test                             # testes de todas as partes
pnpm lint && pnpm typecheck
```

## Documentos

- Produto: `docs/prd.md` (fragmentado em `docs/prd/`)
- Arquitetura: `docs/architecture.md` (fragmentada em `docs/architecture/`)
- Interface: `docs/front-end-spec.md`
- Decisões: `docs/decisoes.md`
- Stories: `docs/stories/`
