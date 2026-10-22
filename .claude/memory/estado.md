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

**Próximo passo (23/10):** o Lucas revisa as [suposições] dos dois documentos:
PRD FR16 (conflito pede confirmação no terminal), FR24 (lembrete em 24 h),
login do conector por código de dispositivo, NFR6 (metas de memória/CPU);
front-end: fonte IBM Plex, paleta, popup da D17 na página da jam, mensagem do
commit editável, pedido cruzado virando aceite. Depois: arquitetura com o
@architect (serviço de tempo real, sincronização, permissão do GitHub, plugin).
