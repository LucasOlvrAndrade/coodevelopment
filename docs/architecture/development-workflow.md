# Development Workflow

## Local Development Setup

### Prerequisites

```bash
node -v        # 22 ou mais novo
pnpm -v        # 10.x
git --version
npx wrangler --version
claude --version   # para testar o plugin
```

### Initial Setup

```bash
pnpm install
vercel link && vercel env pull apps/web/.env.local   # segredos nunca no git
pnpm --filter web db:migrate                          # banco de desenvolvimento (branch do Neon)
```

### Development Commands

```bash
# Start all services
pnpm dev                       # web (3000) + sala (wrangler dev, 1999)

# Start frontend only
pnpm --filter web dev

# Start backend only
pnpm --filter sala dev

# Run tests
pnpm test                      # todas as partes
pnpm --filter conector test    # inclui a integração com duas pastas
pnpm --filter web e2e          # Playwright
```

Para testar a jam a dois numa máquina só: `pnpm --filter conector dev entrar
<jam> --pasta C:\tmp\jam-a` e `... --pasta C:\tmp\jam-b`, com
`COODEV_URL=http://localhost:3000`.

## Environment Configuration

### Required Environment Variables

```bash
# Frontend (.env.local) - nada público além disso
NEXT_PUBLIC_SALA_HOST=coodevelopment-sala.CONTA.workers.dev   # CONTA: subdomínio workers.dev da conta Cloudflare

# Backend (.env.local da web, vindo de vercel env pull)
DATABASE_URL=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=https://coodevelopment.lucas-andrade.dev
GITHUB_APP_ID=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
GITHUB_APP_PRIVATE_KEY=        # token de instalação para o clone
CHAVE_CIFRA_TOKENS=            # AES-256-GCM dos tokens do GitHub
SEGREDO_SALA=                  # assina o JWT da sala
SEGREDO_SERVICO_SALA=          # chamadas internas web <-> sala

# Sala (wrangler secret put)
SEGREDO_SALA=
SEGREDO_SERVICO_SALA=
URL_APP=https://coodevelopment.lucas-andrade.dev

# Conector (opcionais, só para desenvolvimento)
COODEV_URL=
```
