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

Brief em andamento no modo interativo do template oficial
(`project-brief-tmpl.yaml` v2.0), com o @analyst. Seções 1 a 10 aprovadas e
gravadas (a 6 ganhou a ajuda do Node, D13; D14 a D19 ajustaram 3, 5 e 6);
seção 10 revista com D17/D20 e aprovada; seção 11 (Appendices) aprovada;
seção 12 (Next Steps) em revisão. Sem prazo (confirmado em 22/10).
