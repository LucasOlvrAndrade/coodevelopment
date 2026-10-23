# Deployment Architecture

## Deployment Strategy

**Frontend Deployment:**
- **Platform:** Vercel (projeto `coodevelopment`, região `gru1`)
- **Build Command:** `pnpm --filter web build`
- **Output Directory:** `apps/web/.next`
- **CDN/Edge:** CDN da Vercel para estáticos; páginas dinâmicas

**Backend Deployment:**
- **Platform:** Vercel Functions (rotas) e Cloudflare Workers (sala) no
  endereço `coodevelopment-sala.<subdominio-da-conta>.workers.dev`. O DNS de
  `lucas-andrade.dev` está na Vercel (`ns1.vercel-dns.com`, conferido em
  23/10/2026), e a Cloudflare só liga domínio próprio a um Worker quando a
  zona DNS está nela; mover a zona inteira não vale a pena só para isso. O
  endereço da sala fica numa variável (`SALA_HOST`), então trocar depois é
  configuração, não código.
- **Build Command:** `pnpm --filter sala deploy` (`wrangler deploy`)
- **Deployment Method:** Vercel pela integração Git na `main`; sala e
  conector por GitHub Actions na `main`

Rollback: a Vercel volta para o deploy anterior com `vercel rollback` (ou
pelo painel); a sala volta com `wrangler rollback`; o conector com versão
quebrada é marcado `npm deprecate` e a anterior volta a ser `latest` com
`npm dist-tag`. Migrations do Neon só adicionam (coluna nova antes de usar,
remoção num deploy seguinte), para o rollback do app nunca quebrar o banco.

Compatibilidade: a sala aceita a versão de protocolo atual e a anterior,
para um conector desatualizado continuar funcionando; ele avisa quando há
versão nova (`npx` já busca a mais nova a cada `entrar`).

## CI/CD Pipeline

```yaml
name: ci
on: [push, pull_request]
jobs:
  testes:
    runs-on: windows-latest   # o conector roda no Windows (NFR4)
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
```

## Environments

| Environment | Frontend URL | Backend URL | Purpose |
|---|---|---|---|
| Development | http://localhost:3000 | ws://localhost:1999 | Desenvolvimento local |
| Staging | URL de preview da Vercel por PR | sala de preview (`wrangler deploy --env preview`) | Testar antes da `main` |
| Production | https://coodevelopment.lucas-andrade.dev | wss://coodevelopment-sala.CONTA.workers.dev | Uso real |
