# Technical Assumptions

## Repository Structure: Monorepo

Três partes num repositório: o app web, o conector local (pacote `npx`) e um
pacote compartilhado com o protocolo (mensagens de presença, status, aviso e
arquivo), para os dois lados nunca divergirem.

## Service Architecture

Serverless dentro de um monorepo:

- **App web:** Next.js 16 na Vercel (preset AIOX `nextjs-react`: React,
  TypeScript, Tailwind), em `coodevelopment.lucas-andrade.dev`. Rotas do
  próprio Next.js para login, amigos, jams, commit e para autenticar o
  conector.
- **Banco:** Postgres (Neon) para usuários, amizades, jams, participantes e
  eventos do feed.
- **Tempo real:** serviço externo, porque a Vercel não segura conexão
  aberta. Decidido pelo @architect (A1): Cloudflare Durable Objects com
  PartyServer, uma sala por jam, que guarda também o estado dos arquivos
  (FR21). Ver `docs/architecture.md`.
- **Conector:** processo Node que roda no PC enquanto a jam está aberta; vigia
  a pasta, fala com o serviço de tempo real e atende os hooks do Claude Code
  localmente. Distribuído como plugin do Claude Code (hooks + servidor MCP)
  instalado pelo próprio conector.
- **Commit:** feito pelo app via API do GitHub, a partir do estado guardado no
  servidor, com o token do criador da jam.
- Sem máquina na nuvem (D10).

## Testing Requirements

Unidade + integração, mais um teste manual guiado:

- **Unidade:** protocolo, regras de sincronização (`.gitignore`, travas de
  caminho, final de linha), montagem da mensagem de commit, regras de
  amizade.
- **Integração:** conector contra um serviço de tempo real de teste com duas
  pastas temporárias (simula dois PCs); hooks chamados com a entrada JSON
  documentada; rotas do app contra um banco de teste (nunca o de produção).
- **Ponta a ponta no navegador:** login simulado, criar jam, página da jam
  recebendo status.
- **Manual:** roteiro "jam a dois" com o Lucas e o pai antes de cada épico
  ser dado como pronto.
- Cada parte testável sozinha pela linha de comando (o conector tem modo de
  diagnóstico).

## Additional Technical Assumptions and Requests

- Hooks escritos em Node (`node script.js`), independentes do shell, porque no
  Windows os hooks podem rodar em PowerShell; o matcher da ferramenta de
  terminal casa `Bash|PowerShell`.
- Bloqueio de edição sem aviso só vale para `Edit`/`Write`/`NotebookEdit`;
  edição por terminal é detectada pelo vigia do conector (lacuna verificada).
- Login do conector por fluxo de dispositivo (código mostrado no terminal e
  confirmado no navegador) **[confirmado]**.
- Segredos fora do git; `vercel env pull` para trazê-los (regra do Lucas).
- Commit e push a cada passo que passa nos testes (regra do Lucas).
- Permissão do GitHub: GitHub App com token de usuário (A4, NFR9). Login
  com Better Auth (A5).
