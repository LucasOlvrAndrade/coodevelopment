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

**27/10 (noite): 2.1 e 2.2 Done, 2.3 em revisão.** Story 2.1 (criar jam importando) e 2.2 (criar jam com repositório novo) **Done** (gate da 2.1 CONCERNS → correções → PASS; 2.2 PASS). Correções da 2.1: `jam.repo_id` (id numérico do repositório) com o índice da A11 (migração 0004), importar e criar exigem a instalação com "All repositories" (`exigirInstalacaoCompleta`, fecha a pendência 2 da 1.2), dono e repositório validados como no GitHub, `semQuebrar` em todas as chamadas de ação das telas e `error.tsx` em `(app)`. **Story 2.3 (chamar amigos) em InReview**: vaga 1 a 3 única por jam (A12, migração 0005) no lugar do `for update`; colaborador com o token do criador e aceite do convite com o do amigo; `ok`, `pendente` (link do convite) ou `falhou` (tentar de novo). Migrações 0002 a 0005 aplicadas no Neon. App com 198 testes de unidade e componente. **Atenção:** o Claude Code encerrou o `next dev` por falta de memória na máquina; os E2E e o axe das últimas mudanças (2.1 correções, 2.3) ainda não rodaram. **Ações do Lucas:** abrir `/amigos` logado; criar a primeira jam (importando e com repositório novo); chamar o pai para ver se o convite é aceito sozinho (o [verificar] da 2.3); `wrangler login` antes da 2.4 (sala na Cloudflare); branch de teste do Neon para o E2E com sessão.

**28/10 (retomada):** gate da 2.3 deu **FAIL** (convite pelo login guardado podia ir para outra pessoa; "tentar de novo" sem reconferir amizade; pendente que nunca virava ok; erros que sumiam na tela). Correções feitas e no ar (`65fb893`, `95416ee`): login atual pelo `githubId` (`GET /user/{account_id}`) e convidado conferido (convite errado é cancelado); amizade e jam aberta reconferidas dentro do insert e no tentar de novo; participante nasce "falhou" (não adicionado) até o GitHub responder; `sincronizarPendentes` no Início vira ok quem aceitou pelo link; painel com o resultado de cada amigo antes de sair da tela; motivo do GitHub no tentar de novo. 209 testes passando. **Falta:** reavaliação do gate da 2.3 (de preferência com revisor independente, porque o achado era alto) e rodar E2E/axe quando houver memória livre para o `next dev`.

**28/10:** o Lucas criou as primeiras jams (importando e com repositório novo funcionaram) e não conseguia abrir nem gerenciar. A antiga 2.4 foi dividida: **Story 2.4 (página da jam)** feita e no ar, em InReview: `/jams/[id]` com repositório, participantes e situação, chamar mais amigos, tentar de novo e **excluir jam** (A13, o GitHub não é tocado); itens do Início viram links; 404 em português. **Story 2.5** (presença ao vivo, sala na Cloudflare) espera o `wrangler login`. Gate da 2.3 ainda pendente de reavaliação. 223 testes.

**28/10 (tarde): o app inteiro no visual da página inicial (V3),** a pedido do Lucas ("quero tudo com o design da home"). No ar (`f773e81`, docs `6197948`): uma paleta só, sempre escura (`#09090b`, texto `#fafafa`; o tema claro e o verde da V2 saíram, junto com o token `--destaque` e os raios `--radius-*`); Inter, Instrument Serif e Plex Mono carregadas no layout raiz (o layout de `(publico)` foi apagado); a foto da página inicial no alto das telas internas a 60%; cabeçalho com a marca em serifa e a navegação numa pílula translúcida (no celular, pílula flutuante embaixo); ações em pílula, listas em painéis translúcidos, diálogos com o fundo desfocado, selo "Aberta" na página da jam e anel com a cor da vaga na foto de cada participante. As classes ficam em `componentes/ui/estilo.ts` (o `botoes.ts` saiu); o vidro é `texto/5`, `/10` e `/15`, dentro da regra de cor só dos tokens. Front-end spec 0.5 e decisão V3. Conferido em produção com usuários de teste (script `telas-v3.mjs` no scratchpad; em https o cookie é `__Secure-better-auth.session_token`): axe sem violações em todas as telas, em 1280 e 360 px. **Armadilha:** o `next dev` local (no ar desde 27/10, 1,9 GB livres) dá 500 em `/jams/[id]` com "Jest worker encountered 2 child process exceptions"; em produção a página abre, então é o servidor local sem memória, não o código. Reavaliação do gate da 2.3 e gate da 2.4 rodando com revisores independentes.

**28/10 (fim da tarde): 2.3 e 2.4 Done, 2.5 adormecida no ar.**
- **Story 2.3 Done.** A reavaliação deu CONCERNS, com revisor independente: os 5 achados do FAIL foram corrigidos.
  - O médio novo (PERF-001, o Início esperava o GitHub sem prazo) e o SEC-003 foram corrigidos logo depois (`06720a9`). `servidor/sincronizar-pendentes.ts` dá 1,5 s e termina o resto com `after()`.
  - Ficam baixos: convite recusado fica pendente para sempre; ex-amigo continua na jam; formulário ativo depois do painel.
- **Story 2.4 Done.** O gate deu CONCERNS, com revisor independente; os 12 achados foram corrigidos (`7887538`, `115b99e`) e a reavaliação deu PASS.
  - `ResultadoDaAcao`: o resultado das ações fica na tela e recebe o foco quando o botão some.
  - `idDeJamValido` no formato do `gerarIdJam`, conferido antes do banco.
  - Excluir com `router.replace`; textos neutros; selo e links legíveis.
  - AC 4 com evidência em produção: axe em 1280, 375, 360 e 320 px.
- **Story 2.5 InProgress, adormecida no ar.**
  - Feito: token HS256 pela WebCrypto no `packages/protocolo`, sala com presença (testes no workerd), rota `token-sala` (503 sem a sala), "online agora" na página pelo `partysocket` 1.3.0, e job `publicar-sala` no CI (pulado sem os segredos; usa `--secrets-file` por causa do `secrets.required`).
  - `SEGREDO_SALA` gravado na Vercel (sensível) e nos segredos do GitHub. O escopo `workflow` do gh já está liberado.
  - **Ação do Lucas:** conta na Cloudflare com o `workers.dev` registrado, e os segredos `CLOUDFLARE_API_TOKEN` (editar Workers) e `CLOUDFLARE_ACCOUNT_ID` no repositório (`gh secret set`). Depois disso, o próximo push publica, e eu ponho o `NEXT_PUBLIC_SALA_HOST` na Vercel e confiro a presença.
- **Pendências:**
  - CSP completa (`connect-src` e nonce): saiu da 2.5 como item de segurança próprio.
  - Playwright de celular e E2E com sessão: esperam a branch de teste do Neon.
- **Teste de tela:** o script `telas-v3.mjs` do scratchpad usa ids no formato novo (`test-jamz`).

**29/10: Story 3.1 (entrar pelo conector) em InProgress, quase toda no ar.**
- Feito e no ar: login do conector por dispositivo (`/dispositivo`, plugins `deviceAuthorization` e só a entrada do `bearer`), rotas `GET /api/jams/{id}/conector` e `POST /api/conector/clone-token` (GitHub App, só leitura, só o repositório da jam), presença com `online` (página) e `conectados` (conector) e selo "conectado", limite de taxa no banco (migrações 0006 e 0007 aplicadas no Neon). Conector 0.1.0 com `entrar`, `diagnostico` e `sair`, sessão com DPAPI, token de clone por `GIT_CONFIG_*` e revogado depois do clone.
- Os dois [verificar] da story conferidos de verdade: token de clone (lê só o `testejam`, recusa o `projeto-rbc`, escrita dá 403) e DPAPI pelo PowerShell.
- **Falta:** conferência de ponta a ponta com o Lucas (o login pede o navegador dele): numa pasta vazia, `node C:\Users\User\Documents\ProjetosC\coodevelopment\packages\conector\dist\cli.js entrar <id da testejam>`, confirmar em `/dispositivo`, ver o clone. O "conectado" espera a sala (2.5). Também axe e teste de componente de `/dispositivo`, e "sala acessível" no diagnóstico.
- **Conector 0.1.0 no npm (29/10)** por trusted publishing: a próxima versão sai só com a tag `conector-vX.Y.Z` igual ao `package.json`. Ponta a ponta conferido com o Lucas em produção (login, clone do `testejam`, pasta). Armadilhas: `registry-url` do setup-node põe token falso (não usar); no Windows publicar por `npx npm@11.6.2`; no npmjs.com marcar "Allow npm publish"; a passkey do npm não funciona por este PC (TeamViewer, sem Bluetooth): o Lucas confirma pelo celular, no npmjs.com do próprio celular.
- **Ação do Lucas que segue:** a Cloudflare da 2.5 (o "conectado" da 3.1 espera a sala).
- **Página inicial no mesmo dia, a pedido do Lucas:** "Como funciona" virou os três quadrados do logo do Grupo RAM com a escrita GRUPO (em cima) RAM (embaixo) na Sora; passar o mouse (ou tocar, ou focar) num quadrado faz ele sair do logo e crescer até o bloco de texto no meio da seção. A faixa de apps do Grupo RAM virou links para o site de cada um (endereços do `APP_URLS` do gruporam-apps). Ele perguntou da escolha público/privado ao criar repositório: já existia desde a 2.2 (fica atrás de "Criar um repositório novo" em Nova jam). Ponto em aberto: o azul `#22314F` do logo tem contraste baixo no fundo escuro.
