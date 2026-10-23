# Validação do PO: Coodevelopment

`po-master-checklist.md`, modo completo, rodado por Pax (@po) em 2026-10-23
sobre `docs/prd.md` 0.2, `docs/front-end-spec.md` 0.2 e
`docs/architecture.md` 0.1. Projeto greenfield com interface. Seções
puladas: as marcadas [[BROWNFIELD ONLY]], inclusive a 7 inteira.

## Resumo

- **Prontidão:** 88% antes dos ajustes; cerca de 96% depois.
- **Decisão:** APPROVED, depois dos ajustes abaixo, já aplicados (PRD 0.3,
  front-end spec 0.3, arquitetura 0.2).
- **Bloqueios críticos:** 1 achado e corrigido (endereço da sala).

## Category Statuses

| Category | Status | Critical Issues |
|---|---|---|
| 1. Project Setup & Initialization | PASS (após ajuste) | A Story 1.1 não criava a sala nem o plugin, que a arquitetura definiu depois do PRD |
| 2. Infrastructure & Deployment | PASS (após ajuste) | A sala em `sala.coodevelopment.lucas-andrade.dev` era impossível: o DNS está na Vercel e a Cloudflare só liga domínio próprio a Worker com a zona nela. Passou para `workers.dev`. A publicação da sala não estava em nenhuma story; entrou na 2.4 |
| 3. External Dependencies & Integrations | PASS (após ajuste) | Contas e logins (npm, Neon, GitHub App, Cloudflare) não estavam atribuídos a ninguém; viraram a lista "Ações do Lucas" no PRD |
| 4. UI/UX Considerations | PASS (após ajuste) | Faltavam a tela de confirmar o código do conector e a instalação do GitHub App no login; o prompt do Node não instalava o Git, que o conector usa |
| 5. User/Agent Responsibility | PASS (após ajuste) | Ver item 3 |
| 6. Feature Sequencing & Dependencies | PASS | Ordem correta: login (1.2) antes de tudo que usa o GitHub; amigos (1.3) antes de chamar (2.3); sala (2.4) antes do conector (3.1); arquivos (3.3) antes dos avisos (4.x); estado no servidor desde a 3.3, antes do commit (5.1) |
| 7. Risk Management (Brownfield) | N/A | Greenfield |
| 8. MVP Scope Alignment | PASS | Tudo serve ao objetivo de o Lucas e o pai trabalharem juntos; nada sobrando |
| 9. Documentation & Handoff | PARTIAL | Sem guia de uso para o pai além do passo de conexão da própria página (aceitável no MVP); README do monorepo nasce na 1.1 |
| 10. Post-MVP Considerations | PASS | macOS, Linux, mais de 3 pessoas e edição simultânea com Yjs ficam separados e cabem na arquitetura |

## Critical Deficiencies

1. **Endereço da sala impossível** (corrigido na arquitetura 0.2). Conferido
   com `nslookup`: `lucas-andrade.dev` usa `ns1.vercel-dns.com`.

## Ajustes aplicados

- **PRD 0.3:**
  - Premissas técnicas apontam para as decisões A1, A4 e A5.
  - 1.1 cria as cinco partes, com CI no Windows, e reserva o nome no npm.
  - 1.2 usa o GitHub App, com renovação do token.
  - 2.4 publica a sala.
  - 3.2 inclui o Git no prompt.
  - 4.1 avisa da aprovação do MCP.
  - Nova lista "Ações do Lucas".
- **Front-end spec 0.3:**
  - Instalação do GitHub App no login, com orientação de "All repositories".
  - Fluxo "Confirmar o código do conector".
  - Git no prompt e aviso de aprovar o MCP.
- **Arquitetura 0.2:** sala em `coodevelopment-sala.<conta>.workers.dev`,
  com o endereço numa variável.

## Top 5 riscos

1. Plugin instalado pelo conector (4.1). Plano B já escrito na arquitetura.
2. Aceite automático do convite com token do GitHub App (2.3). Plano B: link
   do convite na página.
3. Escrita no disco do Windows com arquivo preso pelo editor ou servidor de
   desenvolvimento (3.3). Mitigação na arquitetura.
4. Instalação do GitHub App com "Only select repositories" deixando
   repositório novo de fora (1.2, 2.2). Mitigação na front-end spec.
5. Dependência da interface de hooks do Claude Code. Testes dos hooks no CI e
   versão mínima no diagnóstico.

## Implementation Readiness

- **Clareza para o desenvolvedor:** 9 de 10.
- **Requisitos ambíguos:** nenhum bloqueante. Sete pontos **[verificar]** da
  arquitetura têm story e plano B.
- **Faltando:** versões fixas das bibliotecas, decididas na 1.1 por regra da
  arquitetura.

## Recomendações

- **Antes de desenvolver:** nada pendente.
- **Durante:** registrar na arquitetura o resultado de cada **[verificar]**.
- **Depois do MVP:** guia curto de uso para quem entra numa jam pela primeira
  vez; política de privacidade antes de abrir para fora do círculo do Lucas.

## Final Decision

**APPROVED**: plano completo e na ordem certa, pronto para fragmentar os
documentos e criar as stories.
