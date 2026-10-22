# Coodevelopment: decisões e arquitetura inicial

Sistema para até três pessoas desenvolverem juntas com o Claude Code na nuvem.
Cada usuário entra com a própria conta, adiciona amigos e cria uma jam a partir
de um repositório do GitHub. A feature principal é o contexto atualizado em
tempo real, com preview do projeto ao vivo. O codesenvolvimento tem que ser
polido e responsivo.

Nome: **Coodevelopment**, em `coodevelopment.lucas-andrade.dev`.

## Decisões do Lucas (2026-10-22)

| # | Decisão | Escolha |
|---|---|---|
| D1 | Onde o Claude Code roda | Sandbox na nuvem por jam (Vercel Sandbox), repo clonado, dev server exposto como preview |
| D2 | Sessões | Uma sessão do Claude por pessoa, no mesmo workspace. A cada prompt, o Claude avisa que vai trabalhar em mudanças e dá um resumo curto do que é |
| D3 | Quem paga o Claude | Uma chave só, do Lucas |
| D4 | Repositório | Na conta de quem cria a jam, com duas opções: importar um repo que ele já tem ou criar um novo. Os outros entram como colaboradores |
| D5 | Commit | Ao fechar a jam, para não haver risco de perder trabalho. Se a jam fechar sozinha (sandbox ocioso ou expirando), o commit e o push acontecem do mesmo jeito antes de desligar |
| D6 | Tamanho da jam | No máximo 3 pessoas por enquanto |
| D7 | Limites de uso | Nenhum por enquanto; no começo o uso é só do Lucas e do pai dele |

## Arquitetura proposta

```
Navegador A ─┐                         ┌─ Neon (usuários, amigos, jams, eventos)
             ├─ app Next.js (Vercel) ──┤
Navegador B ─┘        │                └─ GitHub API (repo, convite de colaborador)
      │               │ cria / acorda
      │ WebSocket     ▼
      └──────── Sandbox da jam
                ├ repo clonado em /workspace
                ├ hub da jam (Node): WebSocket, sessões, eventos
                ├ Claude Agent SDK: uma sessão por pessoa
                └ dev server do projeto → iframe de preview (HMR)
```

- **Login:** GitHub OAuth (Auth.js). Já dá a identidade e o token para criar
  repo e convidar colaborador. O convite é aceito automaticamente com o token
  do amigo (`PATCH /user/repository_invitations/{id}`).
- **Amigos:** pedido de amizade por @ do GitHub; só amigos podem ser chamados
  para uma jam.
- **Tempo real:** funções da Vercel não seguram WebSocket, então o hub roda
  **dentro do sandbox** e os navegadores conectam direto nele, com um token
  curto assinado pelo app. Sem serviço de terceiro.
- **Contexto ao vivo (a feature principal):**
  1. Antes de mexer em qualquer arquivo, a sessão chama a ferramenta
     `anunciar(resumo, arquivos)`; o hub transmite o aviso para o outro.
  2. O aviso entra também no contexto da outra sessão do Claude, então cada
     Claude sabe o que o outro está fazendo.
  3. Um watcher de arquivos transmite cada mudança (arquivo, autor, diff curto).
  4. Hook `PreToolUse`: se o arquivo está reservado pela outra sessão, o
     Claude é avisado antes de editar, e a pessoa vê o conflito na tela.
- **Preview:** dev server do projeto na porta exposta do sandbox, dentro de um
  iframe; o HMR atualiza sozinho a cada edição.
- **Chave do Claude:** a chave do Lucas **nunca entra no sandbox**. O Agent
  SDK aponta `ANTHROPIC_BASE_URL` para um proxy no app, que confere o token da
  jam e encaminha (o limite por usuário fica pronto para quando precisar). Assim nenhum Claude consegue ler
  a chave do ambiente.
- **Persistência:** o sandbox tem tempo máximo de vida; ao fechar ou expirar,
  tira snapshot e o estado (sessões, eventos) fica no Neon. Reabrir a jam
  restaura do snapshot.

## Riscos conhecidos

- **Custo:** sandbox ligado + tokens do Claude, tudo na conta do Lucas. Precisa
  de desligar o sandbox ocioso (fechando a jam, com commit). Sem limite de uso por enquanto (D7).
- **Token do GitHub no sandbox:** o push precisa de credencial. O push é feito
  pelo app (comando pontual no sandbox, token passado só naquele comando), não
  pelo Claude, para o outro não conseguir ler o token de ninguém.
- **Duas sessões no mesmo workspace:** o aviso e a reserva de arquivo reduzem
  conflito, mas não eliminam; precisa de teste com uso real.

## Em aberto

Nada no momento. Próximo passo: brief.
