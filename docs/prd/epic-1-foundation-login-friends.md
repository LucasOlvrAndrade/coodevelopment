# Epic 1 Fundação, login e amigos

Colocar o app no ar no domínio definitivo, com a estrutura do monorepo, e
entregar o primeiro valor real: entrar com o GitHub e montar a rede de
amigos, que é o pré-requisito de qualquer jam.

## Story 1.1 App no ar com a estrutura do monorepo

As a desenvolvedor do Coodevelopment,
I want o monorepo com app web, conector e protocolo criados e o app publicado,
so that toda funcionalidade seguinte já nasça no lugar certo e no ar.

### Acceptance Criteria

1: O repositório tem o app web, a sala, o conector, o plugin e o protocolo
   (estrutura de `docs/architecture.md`), cada um com o próprio comando de
   teste, e um comando que roda tudo. O CI roda os testes no Windows.
2: O app responde em `coodevelopment.lucas-andrade.dev` com uma página inicial
   que explica o produto em uma frase e um botão de entrar.
3: Uma rota de saúde responde que o app e o banco estão acessíveis.
4: Push na `main` publica na Vercel; segredos ficam fora do git.
5: O conector já roda por `npx` (localmente) e responde `--version`; uma
   versão inicial é publicada no npm para reservar o nome `coodevelopment`.

## Story 1.2 Entrar com o GitHub

As a desenvolvedor,
I want entrar no app com a minha conta do GitHub,
so that eu não precise de outra senha e o app possa agir no meu GitHub.

### Acceptance Criteria

1: O botão de entrar leva ao GitHub e volta logado.
2: O primeiro login cria o usuário com nome, usuário e foto do GitHub (FR1).
3: O token do GitHub fica só no servidor, cifrado (NFR8).
4: O usuário sai pelo menu; páginas internas exigem login.
5: O login usa o GitHub App com as permissões da arquitetura (NFR9); a
   instalação do app na conta acontece no mesmo passo do login.
6: A renovação do token do GitHub (validade de 8 h) acontece sozinha antes
   de cada chamada.

## Story 1.3 Amigos por busca e pedido

As a usuário,
I want buscar alguém pelo usuário do GitHub e mandar um pedido de amizade,
so that eu possa chamar essa pessoa para uma jam.

### Acceptance Criteria

1: A busca encontra quem já tem conta no app pelo usuário do GitHub.
2: Enviar pedido cria um pedido pendente visível para os dois.
3: Quem recebe aceita ou recusa; aceitar cria a amizade (FR2).
4: Qualquer um dos dois desfaz a amizade.
5: Não é possível pedir amizade a si mesmo nem duplicar pedido.

## Story 1.4 Sugestões de mútuos do GitHub

As a usuário,
I want ver como sugestão os meus mútuos do GitHub que já usam o app,
so that eu ache meus amigos sem digitar nada.

### Acceptance Criteria

1: A tela de adicionar amigos lista os mútuos (sigo e me seguem) que têm conta
   no app e ainda não são amigos nem têm pedido pendente (FR3).
2: Cada sugestão tem um botão que manda o pedido; nada vira amizade sem aceite.
3: Mútuos sem conta no app não aparecem.
4: A lista funciona com contas que seguem muita gente (paginação da API do
   GitHub).
