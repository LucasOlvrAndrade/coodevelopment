# Verificação: hooks e MCP do Claude Code para o conector

Data: 2026-10-22. Fonte: documentação oficial de hooks,
https://code.claude.com/docs/en/hooks (lida inteira, três trechos).
Motivo: maior risco do brief (Risks & Open Questions, item 1).

## Veredito

**Viável.** As três capacidades que o MVP exige existem. Há uma lacuna:
edição feita por comando de shell não passa pelo bloqueio, só é detectada
depois.

| Capacidade exigida | Resultado | Como |
|---|---|---|
| Saber quando o Claude começa a trabalhar | Sim | `UserPromptSubmit` recebe o texto em `prompt` |
| Saber quando ele termina | Sim | `Stop` (com `last_assistant_message`); `StopFailure` quando cai por erro (`rate_limit`, `authentication_failed`...) |
| Injetar o que os outros estão fazendo a cada prompt | Sim | `UserPromptSubmit` → `hookSpecificOutput.additionalContext` |
| Injetar no meio de uma resposta longa | Sim (bônus) | `PreToolUse` e `PostToolUse` também aceitam `additionalContext` |
| Bloquear edição sem aviso | Sim, para as ferramentas de edição | `PreToolUse` com matcher `Edit\|Write` (+ `NotebookEdit`) → `hookSpecificOutput.permissionDecision: "deny"` + `permissionDecisionReason`, que volta para o Claude |
| Bloquear edição feita por shell | **Não** | Ver "Lacuna" |
| Presença (entrou, saiu) | Sim | `SessionStart` e `SessionEnd` |

## Detalhes que o conector precisa respeitar

- **Entrada comum de todo hook:** `session_id`, `transcript_path`, `cwd`,
  `permission_mode`, `hook_event_name`, `prompt_id`. Hooks de ferramenta
  recebem `tool_name`, `tool_input`, `tool_use_id`.
- **Caminho do arquivo:** `Edit` e `Write` trazem `tool_input.file_path`
  sempre absoluto. `Edit`: `file_path`, `old_string`, `new_string`,
  `replace_all`. `Write`: `file_path`, `content`.
- **Matchers:** só letras, números, `_`, `-`, espaço, `,` e `|` = casamento
  exato (`Edit|Write`); qualquer outro caractere vira regex. Ferramentas MCP
  se chamam `mcp__<servidor>__<ferramenta>`; vindas de plugin,
  `mcp__plugin_<plugin>_<servidor>__<ferramenta>`.
- **Tempo:** `UserPromptSubmit` tem limite padrão de 30 s; os outros, 600 s.
  Hook com `async: true` roda em segundo plano sem travar o Claude. O hook do
  prompt precisa responder rápido: falar com o conector local, nunca esperar
  a internet.
- **Plugin:** um plugin do Claude Code empacota hooks (`hooks/hooks.json`, com
  `${CLAUDE_PLUGIN_ROOT}`) **e** servidor MCP. É o formato natural do
  conector: instala hooks e a ferramenta `anunciar` de uma vez.
- **Windows:** sem Git Bash, os hooks rodam em PowerShell e a ferramenta de
  shell do Claude é `PowerShell`, não `Bash`; casar `Bash|PowerShell`.
  Caminhos chegam com barra invertida. Como o conector já exige Node (D13), os
  hooks devem ser `node script.js`, independentes do shell.
- **`FileChanged` não serve como vigia da pasta:** ele vigia arquivos
  nomeados um a um (ou listas devolvidas em `watchPaths`), não a pasta
  inteira, e não injeta contexto. O conector precisa do próprio vigia.

## Lacuna: edição por comando de shell

O matcher `Edit|Write` não pega arquivo alterado por `Bash`/`PowerShell`
(script, `sed`, gerador de código, `npm install`). Consequências:

1. **Não dá para bloquear** essas edições antes; o aviso obrigatório da D2
   vale só para as ferramentas de edição.
2. **Dá para detectar depois**, de três formas:
   - o vigia de pasta do próprio conector vê qualquer mudança, de qualquer
     origem (é a fonte principal);
   - `PostToolUse` traz `tool_response.bashEditDiff` (arquivos e diffs) em
     repositório git, Claude Code v2.1.269+, em beta e com a configuração
     `bashEditDiffEnabled`;
   - `PostToolUse` sem matcher rodando `git status --porcelain`.
3. **Mitigação proposta:** a instrução do `anunciar` pede para anunciar também
   antes de comandos que alteram arquivos, e mudança detectada sem aviso
   aparece no feed marcada como "sem aviso".

## Efeito no brief

O risco "hooks do Claude Code não bastarem" cai de "derruba o produto" para
"lacuna conhecida": o bloqueio vale para `Edit`/`Write`, e edição por shell é
só detectada. Isso vai para o PRD como requisito explícito.
