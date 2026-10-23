# Pesquisa: tempo real, GitHub App, plugin do Claude Code e login

Data: 2026-10-23. Base das escolhas de `docs/architecture.md`. Fontes oficiais
consultadas no dia; o que não foi confirmado está marcado.

## Serviço de tempo real

| Opção | Plano gratuito | Mensagem máx. | Lógica no servidor |
|---|---|---|---|
| Cloudflare Durable Objects + PartyServer | Workers Free (100 mil req/dia; WebSocket recebido conta 20:1; SQLite 5 GB) | 32 MiB | Sim (código + SQLite por sala) |
| Liveblocks | 3.000 min de tempo real por mês, 10 conexões por sala | 1 MB (broadcast) | Não |
| Vercel WebSockets (GA em 20/10/2026) | Incluso no Hobby, mas a conexão cai em 300 s | não informado | Só no processo; presença e pub/sub em armazenamento externo |
| Ably | 6 milhões de mensagens por mês, 200 conexões | 64 KiB | Não |
| Pusher Channels | 200 mil mensagens por dia, 100 conexões | 10 kB | Não |
| Supabase Realtime | 200 conexões | 256 KB | Parcial |

**Escolha:** Durable Objects + PartyServer. Única que leva arquivo de 1 MB
numa mensagem e guarda o estado da jam junto da conexão sem custo. O
PartyKit foi comprado pela Cloudflare em 04/2024; o que segue mantido é a
biblioteca aberta `cloudflare/partykit` (partyserver, partysocket,
y-partyserver).

Fontes: https://developers.cloudflare.com/durable-objects/platform/pricing/ ,
https://developers.cloudflare.com/durable-objects/platform/limits/ ,
https://github.com/cloudflare/partykit , https://liveblocks.io/pricing ,
https://vercel.com/docs/functions/websockets ,
https://vercel.com/docs/functions/limitations , https://ably.com/pricing ,
https://pusher.com/channels/pricing/ ,
https://supabase.com/docs/guides/realtime/limits

## GitHub App contra OAuth App

- Todas as operações do app funcionam com o token de usuário de um GitHub
  App: criar repositório pessoal e adicionar colaborador (Administration
  write), Git Data API (Contents write), seguidores (Followers read), listar
  repositórios (Metadata read).
- O token de usuário alcança só a interseção entre o que o usuário acessa e
  onde o app está instalado; a instalação com "All repositories" cobre o
  repositório recém-criado. **Não confirmado:** se "selected repositories"
  inclui sozinho um repositório novo.
- Token de usuário do GitHub App expira em 8 h, com refresh token.
- O escopo `repo` do OAuth App dá escrita em todos os repositórios privados,
  inclusive de organizações.
- Com token de usuário, a ação aparece como o próprio usuário.

**Escolha:** GitHub App. Fontes:
https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps ,
https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps

## Plugin do Claude Code

- `.claude-plugin/plugin.json` é opcional; se existe, só `name` é
  obrigatório (kebab-case, sem prefixo `claude-` ou `anthropic-`).
- `hooks/hooks.json` precisa do invólucro `{"hooks": {...}}`; `.mcp.json` na
  raiz do plugin.
- `${CLAUDE_PLUGIN_ROOT}` muda a cada atualização; estado persistente vai em
  `${CLAUDE_PLUGIN_DATA}`.
- Instalação sempre por marketplace: `claude plugin marketplace add <origem>
  --scope user|project|local` e `claude plugin install nome@marketplace
  --scope ...`, os dois sem abrir sessão. Diretório local serve de
  marketplace. Marketplace vindo do npm ainda não existe.
- Escopo `local` grava em `.claude/settings.local.json`, fora do git.
- Servidor MCP de plugin pede aprovação na primeira vez.
- SDK MCP: linha v2 estável, `@modelcontextprotocol/server` 2.3.1
  (05/10/2026); `@modelcontextprotocol/sdk` 1.32.1 é a v1, só com correções.

Fontes: https://code.claude.com/docs/en/plugins-reference ,
https://code.claude.com/docs/en/plugins/cli-reference ,
https://code.claude.com/docs/en/plugin-marketplaces ,
https://code.claude.com/docs/en/plugins/marketplace-reference ,
https://github.com/modelcontextprotocol/typescript-sdk

## Login

- Auth.js é mantido pelo time do Better Auth desde 22/09/2025, só com
  correções de segurança; a v5 nunca saiu do beta (`5.0.0-beta.32`).
- Better Auth 1.7.12 (20/10/2026), com plugin de device authorization (RFC
  8628): `/device/code`, `/device/token`, `/device/approve`, `/device/deny`.

**Escolha:** Better Auth com GitHub e device authorization. Fontes:
https://www.better-auth.com/blog/authjs-joins-better-auth ,
https://www.better-auth.com/docs/plugins/device-authorization
