# Coodevelopment: decisões e arquitetura inicial

Sistema para até três pessoas desenvolverem juntas, cada uma com o próprio
Claude Code no próprio PC, num mesmo projeto. Cada usuário entra com a própria
conta, adiciona amigos e cria uma jam a partir de um repositório do GitHub. A
feature principal é o contexto atualizado em tempo real, com preview do
projeto ao vivo. O codesenvolvimento tem que ser polido e responsivo, e o
sistema tem que servir para projetos de qualquer stack.

Nome: **Coodevelopment**, em `coodevelopment.lucas-andrade.dev`.

Usuários iniciais: o Lucas e o pai, os dois desenvolvedores com Claude Code no
Windows. O app é para começar a trabalhar junto; hoje eles não trabalham no
mesmo projeto ao mesmo tempo. O sistema não é desenhado para nenhum projeto
específico: o RBC foi citado só como exemplo, e serve apenas para testar a
D11 (um projeto com Postgres via `pg` precisa funcionar).

## Decisões do Lucas (2026-10-22)

| # | Decisão | Escolha |
|---|---|---|
| ~~D1~~ | ~~Onde roda~~ | ~~Sandbox na nuvem por jam~~. Substituída pela D8 |
| D2 | Sessões | Uma sessão do Claude Code por pessoa, nos mesmos arquivos. A cada prompt, o Claude avisa que vai trabalhar em mudanças e dá um resumo curto do que é |
| ~~D3~~ | ~~Quem paga o Claude~~ | ~~Uma chave só, do Lucas~~. Deixou de se aplicar com a D10: cada um usa o próprio Claude Code com a própria assinatura |
| D4 | Repositório | Na conta de quem cria a jam, com duas opções: importar um repo que ele já tem ou criar um novo. Os outros entram como colaboradores |
| D5 | Commit | Ao fechar a jam, para não haver risco de perder trabalho. Se a jam fechar sozinha (todos saíram, ociosa, PC desligado), o commit e o push acontecem do mesmo jeito |
| D6 | Tamanho da jam | No máximo 3 pessoas por enquanto |
| D7 | Limites de uso | Nenhum por enquanto; no começo o uso é só do Lucas e do pai dele |
| ~~D8~~ | ~~Onde roda~~ | ~~No navegador (WebContainers)~~. Substituída pela D10: o WebContainers não roda qualquer stack (ex.: Postgres via `pg`, que usa TCP) |
| D9 | Status ao vivo | Todos veem, em tempo real, quando o Claude de alguém está trabalhando e em quê. Exemplo do Lucas: na jam aparece *Claude Code de Lucas está trabalhando em: "breve resumo"*. O status some quando ele termina |
| D10 | Onde o projeto e o Claude rodam | **No PC de cada um.** Cada pessoa usa o próprio Claude Code, com o projeto rodando na própria máquina. Um conector local liga o Claude Code e a pasta do projeto ao app. Sem máquina na nuvem |
| D12 | Achar amigos | Na tela de adicionar amigos, os **mútuos** do GitHub (quem a pessoa segue **e** a segue de volta; cruzamento de `GET /user/following` com `/user/followers`, com o token do login) aparecem como **sugestões**. Não viram amigos automaticamente: é pedido e aceite, como qualquer amizade. A busca pelo usuário do GitHub continua |
| D11 | Stack | O sistema se adapta à stack de qualquer projeto, não só de um. Nada no Coodevelopment pode depender da linguagem, framework ou banco do projeto da jam |

## Arquitetura proposta

```
PC Lucas                                PC pai
├ Claude Code (assinatura dele)         ├ Claude Code (assinatura dele)
├ projeto rodando local (qualquer stack)├ projeto rodando local
└ conector ──────────┐        ┌──────── └ conector
                     ▼        │
            app Coodevelopment (Vercel)
            ├ login GitHub, amigos, jams (Neon)
            ├ tempo real: status, avisos, arquivos, quem está online
            └ commit/push via GitHub API ao fechar
```

- **Login:** GitHub OAuth (Auth.js). Já dá a identidade e o token para criar
  repo e convidar colaborador. O convite é aceito automaticamente com o token
  do amigo (`PATCH /user/repository_invitations/{id}`).
- **Amigos:** pedido de amizade por @ do GitHub; só amigos podem ser chamados
  para uma jam.
- **Conector local:** um programa pequeno que cada participante roda (por
  exemplo `npx coodevelopment entrar <jam>`). Ele:
  1. liga o Claude Code à jam por hooks e por um servidor MCP;
  2. vigia a pasta do projeto e envia as mudanças de arquivo;
  3. aplica na pasta local as mudanças que chegam dos outros;
  4. respeita o `.gitignore`: dependências, build e segredos (`.env`) nunca
     são sincronizados, e é isso que deixa o sistema independente de stack.
- **Status ao vivo (D9):** os hooks do Claude Code avisam quando ele começa e
  termina; o resumo vem da ferramenta `anunciar`. Todos veem *Claude Code de
  Lucas está trabalhando em: "..."*.
- **Contexto ao vivo (a feature principal):**
  1. Antes de mexer em qualquer arquivo, o Claude chama
     `anunciar(resumo, arquivos)` (ferramenta do MCP do conector).
  2. A cada prompt, um hook injeta no contexto do Claude o que os outros
     Claudes estão fazendo agora.
  3. Cada edição é transmitida (arquivo, autor, diff curto).
  4. Hook antes da edição: se o arquivo está reservado pelo aviso de outro
     Claude, o Claude é avisado antes de editar, e a pessoa vê o conflito.
- **Preview:** cada um roda o projeto do jeito que já roda hoje; como os
  arquivos chegam ao vivo, o preview local (com hot reload, quando a stack
  tem) mostra as mudanças de todos. O app não precisa saber subir o projeto.
- **Commit (D5):** o app guarda o estado dos arquivos da jam e faz o commit
  via GitHub API ao fechar, sem depender de nenhum PC ligado.
- **Serviço de tempo real:** a Vercel não segura conexão aberta, então precisa
  de um serviço externo (Liveblocks, PartyKit, Ably ou similar). Escolha do
  @architect.

## Riscos conhecidos

- **Sincronizar pastas locais ao vivo:** dois Claudes escrevendo nos mesmos
  arquivos em máquinas diferentes. O aviso e a reserva reduzem conflito, mas a
  sincronização precisa resolver escrita simultânea sem perder nada.
- **Ambientes diferentes:** cada PC precisa ter o projeto rodando (dependências,
  `.env`, banco). O Coodevelopment não instala nada disso; só avisa quando uma
  mudança mexe em dependência (por exemplo, `package.json`) para o outro
  reinstalar.
- **Ações fora dos arquivos:** migração de banco, instalação de pacote e testes
  que escrevem em banco compartilhado acontecem na máquina de quem rodou e
  podem afetar os outros (ex.: suíte de testes que escreve num banco
  compartilhado). Precisa
  aparecer no feed.
- **Hooks e MCP do Claude Code:** o conector depende da interface de hooks e
  MCP do Claude Code; mudanças nela podem quebrar o conector.

## Em aberto

- Serviço de tempo real (para o @architect).
- Como o conector resolve escrita simultânea no mesmo arquivo (para o
  @architect).
