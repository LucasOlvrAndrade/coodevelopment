# Next Steps

## Ações do Lucas

Só uma pessoa pode fazer estas, porque envolvem conta, login no navegador ou
credencial. O @dev prepara tudo e pede cada uma na story indicada; nenhuma
bloqueia antes disso. Em 23/10/2026 nesta máquina: `npm` sem login e
`wrangler` sem login.

| Story | Ação | Como |
|---|---|---|
| 1.1 | Entrar no npm (conta existente ou nova) para publicar o conector | `! npm login` |
| 1.1 | Criar o banco no Neon pela Vercel e ligar ao projeto | Painel da Vercel, Storage > Neon (ou o @dev pelo CLI, se o login da Vercel já estiver ativo) |
| 1.2 | Criar o GitHub App "Coodevelopment" com as permissões da arquitetura | O @dev gera o manifesto; o Lucas confirma a criação no navegador do GitHub |
| 2.4 | Criar conta na Cloudflare (gratuita) e entrar no `wrangler` | `! npx wrangler login` |
| 3.1 | Ter Node e Git no PC do pai | O próprio passo de conexão guia |

## UX Expert Prompt

@ux-design-expert: crie `docs/front-end-spec.md` com
`front-end-spec-tmpl.yaml` a partir deste PRD e do `docs/brief.md`. Foco na
página da jam (status ao vivo legível de relance, feed, passo de conexão com o
Node) e na leitura no celular. Visual sóbrio de ferramenta de desenvolvedor,
sem cara de template de IA, textos em português sem travessão.

## Architect Prompt

@architect: crie `docs/fullstack-architecture.md` com
`fullstack-architecture-tmpl.yaml` a partir deste PRD, do brief e de
`docs/research/2026-10-22-hooks-claude-code.md`. Decida serviço de tempo real,
algoritmo de sincronização de arquivos, permissão do GitHub e formato do
plugin do Claude Code; respeite NFR1 a NFR13, em especial qualquer stack
(NFR13) e Windows no conector (NFR4).
