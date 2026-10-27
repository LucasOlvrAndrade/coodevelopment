# Estado do Coodevelopment

**2026-10-22:** projeto aberto. Decisões em `docs/decisoes.md`. A arquitetura
mudou duas vezes no mesmo dia: sandbox na nuvem (D1) → navegador com
WebContainers (D8) → **PC de cada um (D10)**, porque o sistema tem que servir
para qualquer stack (D11) e o WebContainers não roda, por exemplo, Postgres
via `pg` (TCP). Cada um usa o próprio Claude Code (a D3, chave única do
Lucas, deixou de se aplicar); um conector local (hooks + MCP + vigia da
pasta) liga Claude Code e projeto ao app.

Valem também: uma sessão por pessoa com aviso a cada prompt (D2), status ao
vivo "Claude Code de Lucas está trabalhando em: ..." (D9), repo importado ou
criado na conta do criador (D4), commit ao fechar a jam (D5) com mensagem
montada dos avisos (D18), a jam nunca fecha sozinha (D14), qualquer
participante fecha (D15), continua se o criador sair (D16), popup ao reabrir
com pasta diferente, e quem segue com a antiga fica só local (D17), lembrete
de trabalho sem commit (D20), nome do perfil do GitHub (D19), mútuos do GitHub
como sugestão de amigo (D12), conector `npx` com ajuda para instalar o Node
(D13), até 3 pessoas (D6), sem limite (D7).

**Usuários:** o Lucas e o pai, os dois desenvolvedores com Claude Code no
Windows (conector do MVP pode ser só Windows; macOS e Linux ficam para os
amigos). O app é para começar a trabalhar junto.

**Não desenhar para um projeto específico.** O RBC foi citado pelo Lucas só
como exemplo ("o rbc foi só um exemplo, não constroi o sistema baseado nele");
ele já foi tirado do brief e das decisões como caso-base.

AIOX 5.4.1 instalado no projeto (`aiox install --quiet --force --merge --ide
claude-code`; o assistente interativo trava neste terminal).

**Brief 1.0 concluído em 22/10** (`docs/brief.md`, template oficial, modo
interativo, 12 seções aprovadas). Sem prazo.

**Hooks verificados em 22/10** (`docs/research/2026-10-22-hooks-claude-code.md`):
viável. Início/fim, injetar contexto e negar `Edit`/`Write` funcionam; edição por
shell só é detectada depois. Conector = plugin do Claude Code (hooks + MCP),
hooks em `node`, casar `Bash|PowerShell` no Windows. Brief virou 1.1.

**PRD 0.1 e especificação de front-end 0.1 feitos em 22/10 em modo YOLO**
(o Lucas pediu "manda bala nessa e no proximo" e saiu; revisa em 23/10).
`docs/prd.md`: 26 FR, 13 NFR, 5 épicos, 19 stories, checklist do PM (NEEDS
REFINEMENT leve). `docs/front-end-spec.md`: fluxos, telas, componentes, paleta
com contraste calculado, IBM Plex, WCAG AA, guiado pela skill cara-de-ia.

**23/10:** o Lucas confirmou todas as suposições ("ok pode mandar bala");
PRD e front-end spec viraram 0.2 com as marcas **[confirmado]**.

**Arquitetura 0.1 feita em 23/10 em modo YOLO** (`docs/architecture.md`,
template `fullstack-architecture-tmpl.yaml`, checklist do arquiteto com
prontidão alta para o Epic 1). Decisões A1 a A6 em `docs/decisoes.md`:
Cloudflare Durable Objects + PartyServer (sala por jam, estado no SQLite),
merge de três vias, base + sobreposição, GitHub App, Better Auth com login
por código, plugin instalado com `--scope local`. Sete pontos marcados
**[verificar]** na story onde são provados (os maiores: plugin pelo conector
na 4.1, aceite do convite com token do GitHub App na 2.3). Nome
`coodevelopment` livre no npm em 23/10.

**Validação do @po em 23/10: APPROVED** (`docs/po-validacao.md`). Achou e
corrigiu um erro crítico: a sala não pode ficar em
`sala.coodevelopment.lucas-andrade.dev`, porque o DNS de `lucas-andrade.dev`
está na Vercel; ficou em `coodevelopment-sala.<conta>.workers.dev`
(arquitetura 0.2). PRD e front-end spec 0.3. O PRD ganhou a lista "Ações do
Lucas" (npm login, Neon, GitHub App, `wrangler login`); `npm` logado como
`lucasolvrandrade` em 23/10; `wrangler` ainda sem login.

**Documentos fragmentados** com `md-tree` (via `npx`) em `docs/prd/`,
`docs/architecture/`, `docs/front-end-spec/`; épicos com nome em inglês
(`epic-1-foundation-login-friends.md`...). `core-config.yaml` aponta
`devLoadAlwaysFiles` para `docs/architecture/`.

**Story 1.1 criada e validada em 23/10** (`docs/stories/1.1.story.md`,
Ready, GO 9/10). CodeRabbit está ligado no config, mas o WSL não está
instalado nesta máquina: gates viram revisão manual com `code-review`.

**Próximo passo:** @dev implementa a 1.1. Ação do Lucas no meio: criar o
banco Neon pela Vercel (Task 8); 2FA do npm ao publicar (Task 9).

**26/10:** tasks 1 a 7 e 10 da Story 1.1 feitas (CI verde no Windows; versões e licenças fixadas na Tech Stack, PartyServer é ISC). Task 8 feita no mesmo dia: Neon `coodevelopment` em sa-east-1, `/api/saude` com banco ok em produção. Task 9 feita também: `coodevelopment@0.0.1` no npm. A conta do npm tem 2FA só por passkey, e assim o `npm publish` pelo login web dá 403; o caminho foi token granular de 7 dias com bypass (o Lucas configura no terminal dele, removido depois). Para as próximas versões: trusted publishing pelo GitHub Actions. **Story 1.1 em InReview**; gate do @architect em 26/10: **CONCERNS** (5 ACs PASS; `db:migrate` não lê o `.env.local`, `.env.example` com lixo do template do AIOX, H1 de 36 px fora da escala). Correções aplicadas no mesmo dia e reavaliação PASS: **Story 1.1 Done em 26/10**. `pnpm db:migrate` funciona (lê `apps/web/.env.local`). Story 1.2 (login com GitHub) criada em 26/10 em Draft, checklist READY. Achados ao criar: Better Auth tem `account.encryptOAuthTokens` nativo (talvez dispense `CHAVE_CIFRA_TOKENS`); com GitHub App ele exige a permissão Email addresses read (fora da tabela da arquitetura); o callback da instalação chega sem o `state` do Better Auth; neon-http não tem transação. @po validou a 1.2 em 26/10: GO 9/10, Ready (corrigida a contradição entre "Request user authorization during installation" e a Setup URL). **1.2 implementada em 26/10 e em InReview**: GitHub App `coodevelopment` (id 5481248) criado por manifesto com servidor local que grava as chaves direto na Vercel; login, instalação (A7), Início, Sair e tokens cifrados (A8) conferidos em produção com o Lucas. Armadilhas achadas: Better Auth descarta campos `input: false` do perfil (usar `disabledPaths` para travar `/update-user`); as rotas HTTP `/get-access-token` e `/refresh-token` devolvem o token do GitHub e ficaram desligadas. Pendentes: E2E com sessão injetada (branch de teste do Neon) e "selected repositories" (fica para a 2.2). **Gate da 1.2 em 27/10: FAIL**, volta para InProgress (gate em `docs/qa/gates/1.2-entrar-com-github.yml`). ALTO: a vinculação implícita por e-mail do Better Auth está ligada e permite tomar a conta de outro (desligar `accountLinking`). MÉDIO: o Better Auth não confere `error` na resposta 200 do refresh do GitHub e devolve o token vencido sem erro. MÉDIO: testes de renovação, cifra e saudação faltando; E2E do alerta instável por causa do `__next-route-announcer__`. O Lucas deixou a branch do Neon para depois. Próximo: `*apply-qa-fixes` pelo @dev e reavaliação.

**27/10 (parada para reiniciar a sessão):** correções do gate da 1.2 aplicadas e reavaliação PASS: **Story 1.2 Done** (`93c857b`). Vinculação por e-mail desligada; renovação própria que lança no `200 bad_refresh_token` (conferido no GitHub real) e `ErroApp("reautenticar")`; índices únicos em `account` (migração 0001 aplicada no Neon); modelo `Usuario` no protocolo; `onAPIError.errorURL`; Sair avisa quando falha; 41 testes e 7 E2E. O Lucas pediu para fazer tudo de uma vez e mandar só o relatório no fim (o método passo a passo estava lento).
**Design da página inicial na `main` em 27/10** (`f6b1da6`, `3118b43`): o Lucas mandou o `responsive-hero-banner` do 21st.dev e pediu o verde do Grupo RAM (`#0f7433`). A primeira adaptação (fundo em CSS, passos no lugar dos parceiros) foi recusada: ele pediu **"exatamente igual o prompt"**, e no lugar dos parceiros **os aplicativos do Grupo RAM passando em loop**, em branco (RAM Firewall, Click Fone, RAM Backup, RAM Talk, RAM Vision, CRM, com os SVGs oficiais de `gruporam-apps/index.html`). Ficou: foto do componente em `src/imagens/hero-fundo.jpg` (servida pelo app, a CSP só libera app e GitHub), Inter e Instrument Serif só no layout de `(publico)`, menu do celular que abre de verdade, botão de pausa da faixa (WCAG 2.2.2), seção "Como funciona" abaixo. O verde fica como `--primaria` das telas internas (V2); a página inicial usa as cores do componente. Decisões V1 e V2 em `decisoes.md`, front-end spec 0.4. Armadilha: o `next dev` neste Windows às vezes perde uma edição de CSS (vigia de arquivos); se o visual não bater com o arquivo, reiniciar o servidor. pnpm agora roda direto (shim do corepack em `C:\Users\User\bin`). Depois: Story 1.3 (amigos).

**27/10 (tarde): Epic 1 completo.** Story 1.3 (amigos por busca e pedido) e 1.4 (sugestões de mútuos do GitHub) **Done**, gates PASS depois de CONCERNS (duas rodadas com revisor independente). Migrações 0002 (amigos) e 0003 (jams) aplicadas no Neon. Decisões novas: A9 (escrita de vários passos numa instrução SQL só, porque o neon-http não tem transação; para `for update` na 2.3 trocar para o Pool por WebSocket), A10 (busca exata pelo login; recusar não bloqueia; desfazer amizade conta como recusa de quem desfez; sugestão não insiste em quem disse não), A11 (uma jam aberta por repositório, índice único parcial). Testes de regras contra **PGlite** com as migrações reais (`tests/apoio/banco-teste.ts`); telas conferidas com usuários de teste temporários no Neon (sessão própria, cookie assinado com o `BETTER_AUTH_SECRET`, apagados no fim; script em scratchpad). Mútuos do GitHub em cache de 5 min por pessoa (`servidor/cache-memoria.ts`). Contador de pedidos da barra por `GET /api/amigos/pedidos-recebidos`. Avatar: iniciais em `text-fundo` (a V2 tinha deixado branco sobre laranja claro no escuro). Botões em `componentes/ui/botoes.ts`. **Story 2.1 (criar jam importando) em InReview** (Nova jam e Início com as jams no ar). Story 2.2 escrita (Draft). **Ações do Lucas:** abrir `/amigos` logado (sugestões reais do GitHub) e criar a primeira jam em `/jams/nova`; o E2E com sessão segue pedindo a branch de teste do Neon; `wrangler login` antes da 2.4.
