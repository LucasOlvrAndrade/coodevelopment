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
Lucas" (npm login, Neon, GitHub App, `wrangler login`); nesta máquina `npm`
e `wrangler` estão sem login.

**Documentos fragmentados** com `md-tree` (via `npx`) em `docs/prd/`,
`docs/architecture/`, `docs/front-end-spec/`; épicos com nome em inglês
(`epic-1-foundation-login-friends.md`...). `core-config.yaml` aponta
`devLoadAlwaysFiles` para `docs/architecture/`.

**Próximo passo:** @sm cria a Story 1.1 (`create-next-story`), depois @po
valida e @dev implementa.
