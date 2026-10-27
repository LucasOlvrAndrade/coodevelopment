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
| D5 | Commit | Ao fechar a jam, para não haver risco de perder trabalho. Até alguém fechar, o estado dos arquivos fica guardado no servidor (a jam não fecha sozinha, D14) |
| D14 | Fechamento automático | **Não existe.** A jam só fecha quando um participante fecha |
| D15 | Quem fecha | Qualquer participante |
| D16 | Criador sai | Nada acontece; a jam continua com os outros |
| D17 | Pasta local diferente ao reabrir | Popup perguntando se quer atualizar a pasta local ou seguir com a versão mais antiga. Quem segue com a antiga fica **só local**: as mudanças dele não sincronizam até ele atualizar, para nunca sobrescrever o trabalho dos outros |
| D20 | Lembrete de trabalho não salvo | A jam mostra um lembrete quando tem trabalho sem commit há muito tempo (a jam não fecha sozinha, D14) |
| D18 | Mensagem do commit | Montada a partir dos avisos (`anunciar`) feitos durante a jam |
| D19 | Nome no status | Vem do perfil do GitHub |
| D6 | Tamanho da jam | No máximo 3 pessoas por enquanto |
| D7 | Limites de uso | Nenhum por enquanto; no começo o uso é só do Lucas e do pai dele |
| ~~D8~~ | ~~Onde roda~~ | ~~No navegador (WebContainers)~~. Substituída pela D10: o WebContainers não roda qualquer stack (ex.: Postgres via `pg`, que usa TCP) |
| D9 | Status ao vivo | Todos veem, em tempo real, quando o Claude de alguém está trabalhando e em quê. Exemplo do Lucas: na jam aparece *Claude Code de Lucas está trabalhando em: "breve resumo"*. O status some quando ele termina |
| D10 | Onde o projeto e o Claude rodam | **No PC de cada um.** Cada pessoa usa o próprio Claude Code, com o projeto rodando na própria máquina. Um conector local liga o Claude Code e a pasta do projeto ao app. Sem máquina na nuvem |
| D12 | Achar amigos | Na tela de adicionar amigos, os **mútuos** do GitHub (quem a pessoa segue **e** a segue de volta; cruzamento de `GET /user/following` com `/user/followers`, com o token do login) aparecem como **sugestões**, mas só os que já têm conta no Coodevelopment (sem link de convite). Não viram amigos automaticamente: é pedido e aceite, como qualquer amizade. A busca pelo usuário do GitHub continua |
| D13 | Conector e Node | O conector é um pacote `npx` (o Lucas acredita que o pai tem Node). Ao entrar na jam, enquanto o conector não conectou, a página avisa que a jam precisa do Node.js para funcionar, mostra um **prompt pronto para copiar e mandar ao Claude Code** instalar o Node, e um botão **"Já instalei"**, que mostra o comando de entrar e espera o conector conectar. O navegador não consegue detectar o Node no PC, por isso o botão |
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

## Decisões de arquitetura (2026-10-23)

Detalhes em `docs/architecture.md`; pesquisa em
`docs/research/2026-10-23-tempo-real-github-plugin.md`.

| # | Decisão | Escolha |
|---|---|---|
| A1 | Serviço de tempo real | Cloudflare Durable Objects com PartyServer, uma sala por jam, estado no SQLite da sala |
| A2 | Escrita simultânea | Versão por arquivo; merge de três vias na sala; se os trechos se cruzam, fica a primeira e a outra é guardada no histórico, com aviso |
| A3 | Estado no servidor | Commit de partida mais os arquivos mudados desde ele; fechar é um commit direto |
| A4 | Permissão do GitHub | GitHub App com token de usuário (não OAuth App com `repo`) |
| A5 | Login | Better Auth (Auth.js está em manutenção), com login por código para o conector |
| A6 | Plugin | Instalado pelo conector com `claude plugin install --scope local`, fora do git do projeto |
| A7 | Instalação do GitHub App no login (Story 1.2) | O login sempre começa pelo Better Auth (autorizar o app); na volta, sem instalação na conta (`GET /user/installations`), o app manda direto para `github.com/apps/coodevelopment/installations/new`, e a Setup URL volta para `/inicio`. "Request user authorization during installation" fica desligado: com ele, o GitHub devolve o código sem o `state` que o Better Auth confere e deixa a Setup URL indisponível. Para a pessoa são duas telas do GitHub em sequência, sem tela do app no meio |
| A8 | Cifra dos tokens do GitHub (Story 1.2) | `account.encryptOAuthTokens` do Better Auth: XChaCha20-Poly1305 (cifra autenticada) com chave derivada do `BETTER_AUTH_SECRET`, conferido no código da 1.7.13. Substitui o AES-256-GCM com `CHAVE_CIFRA_TOKENS` previsto na arquitetura 0.2: mesma garantia (NFR8), uma variável a menos. Custo aceito: trocar o `BETTER_AUTH_SECRET` exige a rotação de chaves do Better Auth (`secrets`), senão os tokens guardados param de abrir e cada pessoa entra de novo |
| A9 | Escrita de mais de um passo sem transação (Story 1.3) | O driver `neon-http` não tem transação interativa (`db.transaction`), e o modelo pede que aceitar um pedido apague o pedido e crie a amizade juntos. Cada regra de mais de um passo vira **uma instrução SQL só**, com CTEs que alteram dados (`with apagado as (delete ... returning ...) insert ...`): o Postgres executa a instrução inteira ou nada. A ordem do par da amizade sai de `least`/`greatest` no banco, com a mesma collation do check. Quando uma regra precisar de `select ... for update` (chamar amigo, Story 2.3), trocar para o Pool do `@neondatabase/serverless` por WebSocket |
| A10 | Busca e recusa de amizade (Story 1.3) | A busca é **exata** pelo usuário do GitHub, sem diferença de maiúscula e com `@` opcional: por prefixo, digitar uma letra listaria quem usa o app. Como `login` não é único no banco, a busca pode trazer duas pessoas, cada uma com nome e foto. **Recusar não bloqueia:** o pedido some das duas listas, e quem pediu pode pedir de novo (o mesmo registro volta a pendente), para ninguém ficar preso por um clique errado; bloquear fica para quando houver abuso. **Desfazer a amizade conta como recusa de quem desfez** (gate da 1.4): o outro não volta como sugestão de mútuo, mas ainda pode pedir de novo; sugestão nunca insiste em quem disse não |
| A11 | Uma jam aberta por repositório (Story 2.1) | Com uma jam não fechada no repositório, criar outra dá `jam_ja_existe` e manda para o Início; a jam fechada volta pela reabertura (Story 5.2). Duas jams abertas no mesmo repositório fariam dois commits concorrentes na mesma branch. Garantido por índice único parcial no **`repo_id`** (id numérico do repositório no GitHub) com `estado <> 'fechada'`, não só pela regra: dono e nome mudam quando alguém renomeia, o id não (gate da 2.1). Importar e criar repositório exigem a instalação do app com "All repositories" |
| A12 | Limite de 3 por jam sem transação (Story 2.3) | Cada participante ocupa uma **vaga** de 1 a 3, única por jam (`unique (jam_id, vaga)`, `check (vaga between 1 and 3)`); o criador fica com a 1. Chamar amigo pega a menor vaga livre numa instrução só; se outro chamado pegou a mesma vaga ao mesmo tempo, o índice recusa e a regra tenta a próxima. Substitui o `select ... for update` previsto na arquitetura, que pediria o Pool por WebSocket (A9): o banco garante o limite (D6) com o `neon-http`. A vaga é registrada antes do GitHub; o estado do colaborador (`ok`, `pendente` com o link do convite, `falhou` com tentar de novo) nunca fica pela metade |

## Decisões de design (2026-10-27)

Detalhes na front-end spec 0.4 (Branding & Style Guide).

| # | Decisão | Escolha |
|---|---|---|
| V1 | Página inicial | O `responsive-hero-banner` do 21st.dev **igual ao prompt** (o Lucas pediu exatamente igual depois de uma primeira adaptação): a foto do componente, servida pelo app (a CSP só libera imagens do app e do GitHub), menu em pílula com o botão branco, botões translúcidos, Instrument Serif e Inter, nas cores do componente. No lugar dos logos de parceiros (seriam falsos), os aplicativos do Grupo RAM (RAM Firewall, Click Fone, RAM Backup, RAM Talk, RAM Vision, CRM) passam em loop, em branco, com botão de pausa (WCAG 2.2.2). O menu do celular abre de verdade (no original o botão não fazia nada). Abaixo da faixa, "Como funciona" com três passos, destino do link do menu e do botão secundário. É exceção às regras sóbrias da spec só na página inicial; as telas internas não mudam |
| V2 | Cor primária | O verde do Grupo RAM, `#0f7433` (arquivo oficial da marca), nos dois temas, só como preenchimento (texto branco sobre ele dá 5,9:1). Verde em texto usa o token `--destaque`: `#0f7433` no claro (5,4:1 sobre o fundo) e `#4cc27a` no escuro (8,2:1) |

## Em aberto

- Nada para o @architect. Sete pontos a provar nas stories estão marcados
  **[verificar]** na arquitetura.
