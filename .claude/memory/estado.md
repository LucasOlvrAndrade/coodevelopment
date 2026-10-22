# Estado do Coodevelopment

**2026-10-22:** projeto aberto. Decisões em `docs/decisoes.md`. A arquitetura
mudou duas vezes no mesmo dia: sandbox na nuvem (D1) → navegador com
WebContainers (D8) → **PC de cada um (D10)**, porque o primeiro uso real é o
RBC (Next.js + `pg` via TCP, que não roda no WebContainers) e porque o
sistema tem que servir para qualquer stack (D11). Cada um usa o próprio
Claude Code (a D3, chave única do Lucas, deixou de se aplicar); um conector
local (hooks + MCP + vigia da pasta) liga Claude Code e projeto ao app.

Valem também: uma sessão por pessoa com aviso a cada prompt (D2), status ao
vivo "Claude Code de Lucas está trabalhando em: ..." (D9), repo importado ou
criado na conta do criador (D4), commit ao fechar a jam inclusive quando fecha
sozinha (D5), até 3 pessoas (D6), sem limite (D7).

**Usuários:** o Lucas e o pai, que programa com o Claude Code do mesmo jeito.
O app é para começar a trabalhar junto; primeiro uso: implementar juntos o
sistema de backup do RBC.

AIOX 5.4.1 instalado no projeto (`aiox install --quiet --force --merge --ide
claude-code`; o assistente interativo trava neste terminal).

Brief em andamento no modo interativo do template oficial
(`project-brief-tmpl.yaml` v2.0), com o @analyst. Seções 1 a 4 aprovadas e
gravadas (a 1 corrigida pela D10); seção 5 em revisão. O pai também usa
Windows (confirmado em 22/10): o conector do MVP pode ser só Windows; macOS e
Linux ficam para o segmento secundário (amigos).
