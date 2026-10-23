# Coding Standards

## Critical Fullstack Rules

- **Protocolo único:** toda mensagem entre as partes é definida em
  `packages/protocolo` com zod e validada ao receber. Nada de objeto montado à
  mão fora dele.
- **Token do GitHub só em `apps/web/src/servidor`:** marcado com
  `import "server-only"`; nunca em resposta, log, conector ou sala (NFR8).
- **Toda escrita em disco do conector passa por `gravarSeguro()`:** que
  confere a raiz, `.git/`, link simbólico e a lista fixa (FR18). Proibido
  `fs.writeFile` direto em `sincronizacao.ts`.
- **Hooks nunca travam o Claude:** tempo máximo de 2 s falando com o conector;
  sem conector ou com erro, saem com código 0 e sem saída (exceto o
  `PreToolUse` com decisão). Nunca acessam a internet (NFR5).
- **Caminho de arquivo no protocolo:** sempre relativo e com `/`; conversão
  para o caminho do Windows só na hora de gravar.
- **Comparação de conteúdo sempre pelo hash do texto normalizado (LF):** nunca
  pelos bytes do disco (NFR7).
- **Variáveis de ambiente:** lidas só em `servidor/env.ts` (web) e `env.ts`
  (sala), validadas com zod na inicialização.
- **Texto da interface em português do Brasil, sem travessão (NFR12).**
- **Segredos fora do git; `vercel env pull` e `wrangler secret` para trazê-los.**

## Naming Conventions

| Element | Frontend | Backend | Example |
|---|---|---|---|
| Components | PascalCase | - | `FaixaParticipante.tsx` |
| Hooks | camelCase com `use` | - | `use-sala.ts` exporta `useSala` |
| API Routes | - | kebab-case | `/api/jams/[id]/token-sala` |
| Database Tables | - | snake_case | `pedido_amizade` |
| Mensagens da sala | - | kebab-case no campo `tipo` | `divergencia-escolha` |
| Domínio | português | português | `chamarAmigo`, `aplicarEscrita` |
