# Coodevelopment Product Requirements Document (PRD)

Template `prd-tmpl.yaml` v2.0, gerado em modo YOLO (sem revisão seção por
seção) a pedido do Lucas, em 2026-10-22, para revisão no dia seguinte. Tudo o
que não veio do brief nem das decisões foi marcado como suposição; o Lucas
confirmou todas em 2026-10-23 (versão 0.2), agora marcadas **[confirmado]**.

Base: `docs/brief.md` (1.1), `docs/decisoes.md` (D1 a D20),
`docs/research/2026-10-22-hooks-claude-code.md`.

## Goals and Background Context

### Goals

- Dois ou três desenvolvedores trabalham no mesmo projeto ao mesmo tempo, cada
  um com o próprio Claude Code, sem trabalhar em turnos.
- Cada participante sabe, a qualquer momento e sem perguntar, se o Claude dos
  outros está trabalhando e em quê.
- Cada Claude sabe o que os outros Claudes estão fazendo e é avisado antes de
  mexer num arquivo que outro anunciou.
- As mudanças de cada um chegam ao vivo na pasta dos outros, e o projeto
  rodando em cada PC mostra o trabalho de todos.
- Nenhum trabalho se perde: ao fechar a jam, tudo vira commit e push, sem
  merge manual.
- Funciona com projetos de qualquer stack, sem o Coodevelopment conhecer o
  projeto.

### Background Context

Quem programa com o Claude Code trabalha sozinho por construção: cada sessão é
de uma pessoa, o status dela só aparece no terminal de quem a abriu, e o
trabalho de um só chega ao outro depois do push. O Lucas e o pai, os dois
desenvolvedores com Claude Code no Windows, querem começar a construir juntos
e hoje só conseguiriam fazer isso em turnos.

O Coodevelopment não substitui o Claude Code, o editor nem o jeito de rodar o
projeto. Ele acrescenta uma camada de coordenação: uma **jam** (sala ligada a
um repositório do GitHub) e um **conector local** que liga o Claude Code e a
pasta do projeto à jam, por hooks e por um servidor MCP. A arquitetura passou
por sandbox na nuvem e por navegador antes de chegar aqui (D1, D8, D10); a
razão de ficar no PC de cada um é servir para qualquer stack (D11).

### Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-10-22 | 0.1 | Primeira versão, modo YOLO, a partir do brief 1.1 | Morgan (@pm), via Claude |
| 2026-10-23 | 0.2 | Lucas confirmou todas as suposições | Morgan (@pm), via Claude |
| 2026-10-23 | 0.3 | Ajustes da validação do @po: decisões da arquitetura, partes novas na 1.1, GitHub App na 1.2, sala na 2.4, Git no prompt da 3.2, aprovação do MCP na 4.1, ações do Lucas | Pax (@po), via Claude |

## Requirements

### Functional

- **FR1:** O usuário entra e sai do app com a conta do GitHub. Nome e foto
  exibidos vêm do perfil do GitHub (D19).
- **FR2:** O usuário busca outra pessoa pelo usuário do GitHub e envia pedido
  de amizade; quem recebe aceita ou recusa. Amizade é desfeita por qualquer um
  dos dois.
- **FR3:** A tela de adicionar amigos sugere os mútuos do GitHub (quem o
  usuário segue e o segue de volta) que já têm conta no app. Sugestão não cria
  amizade: é preciso pedir e o outro aceitar (D12).
- **FR4:** O usuário cria uma jam importando um repositório próprio do GitHub
  ou criando um repositório novo na própria conta (D4).
- **FR5:** O criador chama até 2 amigos para a jam (D6). Cada chamado vira
  colaborador do repositório e o convite do GitHub é aceito automaticamente
  em nome dele.
- **FR6:** Só amigos podem ser chamados para uma jam.
- **FR7:** O usuário vê a lista das jams de que participa, com quem está
  dentro de cada uma.
- **FR8:** A página da jam mostra os participantes, quem está conectado agora
  e o status ao vivo do Claude de cada um.
- **FR9:** Enquanto o conector do usuário não conectou, a página da jam mostra
  o passo de conexão: aviso de que a jam precisa do Node.js, prompt pronto
  para copiar e mandar ao Claude Code instalar o Node, botão "Já instalei" e,
  depois dele, o comando de entrar (D13).
- **FR10:** O conector é executado por `npx` com o identificador da jam. Ele
  autentica o usuário sem token colado à mão, liga a pasta do projeto à jam e
  clona o repositório se a pasta ainda não existir.
- **FR11:** Ao entrar, o conector deixa o Claude Code daquela pasta pronto para
  a jam (hooks e ferramenta `anunciar`), sem configuração manual.
- **FR12:** Quando o Claude de um participante começa a trabalhar, todos veem
  *"Claude Code de {nome} está trabalhando em: {resumo}"*; quando ele termina,
  ou para por erro, o status some (D9).
- **FR13:** Antes de editar arquivos, o Claude anuncia o resumo do que vai
  fazer e os arquivos que vai tocar (`anunciar`); o resumo vira o texto do
  status e um item no feed (D2).
- **FR14:** Uma edição feita pela ferramenta de edição do Claude sem aviso
  ativo é recusada, com o motivo devolvido ao Claude para ele anunciar antes.
- **FR15:** A cada prompt, e também durante respostas longas, o Claude recebe
  o que os outros Claudes estão fazendo agora (avisos ativos e arquivos
  reservados), marcado como informação e não como instrução.
- **FR16:** Antes de o Claude editar um arquivo anunciado por outro Claude,
  ele é avisado do conflito e a pessoa vê o conflito na página da jam e no
  terminal. **[confirmado]** O conflito avisa e pede confirmação; não bloqueia
  de forma definitiva.
- **FR17:** Cada mudança de arquivo num PC chega à pasta dos outros
  participantes conectados, respeitando o `.gitignore` do projeto;
  dependências, build e `.env` nunca são enviados (D11).
- **FR18:** O conector recusa aplicar arquivo de fora da pasta do projeto ou
  de dentro de `.git/`.
- **FR19:** Mudanças de arquivo que não vieram de um aviso (por exemplo, feitas
  por comando de terminal) aparecem no feed marcadas como "sem aviso".
- **FR20:** O feed da jam registra avisos, arquivos alterados (autor e resumo
  da diferença) e ações que afetam os outros, como mudança em arquivo de
  dependências que pede reinstalação.
- **FR21:** O estado atual dos arquivos da jam fica guardado no servidor, de
  modo que nenhum trabalho depende de um PC estar ligado (D5).
- **FR22:** Qualquer participante fecha a jam (D15). Fechar gera um commit com
  o trabalho de todos e faz push no repositório; a mensagem do commit é
  montada a partir dos avisos da sessão (D18) e os participantes aparecem
  como coautores.
- **FR23:** A jam nunca fecha sozinha (D14) e continua normalmente se o
  criador sair (D16).
- **FR24:** A jam mostra um lembrete quando tem trabalho sem commit há mais de
  **[confirmado]** 24 horas (D20).
- **FR25:** Uma jam fechada pode ser reaberta, a partir do último commit.
- **FR26:** Ao reabrir, se a pasta local de alguém estiver diferente da versão
  da jam, um popup pergunta se ele quer atualizar a pasta ou seguir com a
  versão mais antiga; seguindo com a antiga, nada dele sincroniza até ele
  atualizar (D17).

### Non Functional

- **NFR1:** O status de um Claude aparece para os outros em até 1 s após ele
  começar, em 95% dos casos.
- **NFR2:** Uma mudança de arquivo chega à pasta dos outros em até 2 s, em 95%
  dos casos.
- **NFR3:** Toda jam fechada termina com commit e push (100%); nenhuma
  mudança sincronizada se perde.
- **NFR4:** O conector roda no Windows 10 e 11 no MVP, com Node.js LTS. macOS e
  Linux ficam para depois.
- **NFR5:** Os hooks do conector respondem dentro do limite do Claude Code (30
  s no envio de prompt) sem depender da internet: falam só com o processo
  local do conector.
- **NFR6:** O conector não pode pesar perceptivelmente no PC enquanto o projeto
  e o Claude Code rodam. **[confirmado]** Meta: menos de 150 MB de memória e
  CPU ociosa abaixo de 2% com a pasta parada.
- **NFR7:** O conector normaliza final de linha (CRLF e LF) para que a
  sincronização entre PCs não gere mudanças falsas nem laço.
- **NFR8:** O token do GitHub fica só no servidor, cifrado; nunca vai para o
  conector nem para o navegador.
- **NFR9:** O app pede ao GitHub a menor permissão que permita criar
  repositório, convidar colaborador e commitar.
- **NFR10:** A página da jam é responsiva e polida no computador e no celular
  (a partir de 360 px de largura), e segue WCAG AA.
- **NFR11:** O custo de operação cabe nos planos que o Lucas já usa (Vercel,
  Neon) mais o plano gratuito ou mais barato do serviço de tempo real; o
  Claude não custa nada ao app.
- **NFR12:** Textos da interface em português do Brasil, sem travessão.
- **NFR13:** O sistema não pode depender da linguagem, framework ou banco do
  projeto da jam (D11).

## User Interface Design Goals

### Overall UX Vision

Uma sala de trabalho calma, que deixa a informação mais importante sempre à
vista: quem está aqui e o que cada Claude está fazendo agora. O app não
compete com o editor nem com o terminal; ele fica numa aba ou no celular ao
lado, e precisa ser legível de relance. O passo de conexão é o único momento
de "configuração" e deve ser guiado, um passo por vez.

### Key Interaction Paradigms

- **Presença em tempo real:** status e feed se atualizam sozinhos, sem
  recarregar; nada pisca nem pula de lugar quando chega coisa nova.
- **Leitura de relance:** cada participante é uma faixa com foto, nome e o
  status do Claude dele em uma frase.
- **Configuração guiada:** o passo de conexão (Node, comando de entrar) é um
  roteiro curto com botão de copiar.
- **Ações raras e explícitas:** fechar a jam pede confirmação e mostra o que vai
  ser commitado.

### Core Screens and Views

- Entrar (login com GitHub)
- Início: minhas jams
- Amigos: amigos, pedidos e sugestões de mútuos
- Nova jam: importar ou criar repositório, chamar amigos
- Página da jam: participantes com status ao vivo, feed, passo de conexão,
  lembrete de trabalho não salvo, fechar jam
- Confirmação de fechar jam
- Popup de pasta diferente ao reabrir (D17)

### Accessibility: WCAG AA

### Branding

Sem identidade definida. **[confirmado]** Visual sóbrio de ferramenta de
desenvolvedor, sem cara de template de IA (sem degradê roxo, sem
glassmorphism, sem emoji na interface). Definição na especificação de
front-end.

### Target Device and Platforms: Web Responsive

App web responsivo, computador e celular. O conector é uma ferramenta de
linha de comando para Windows.

## Technical Assumptions

### Repository Structure: Monorepo

Três partes num repositório: o app web, o conector local (pacote `npx`) e um
pacote compartilhado com o protocolo (mensagens de presença, status, aviso e
arquivo), para os dois lados nunca divergirem.

### Service Architecture

Serverless dentro de um monorepo:

- **App web:** Next.js 16 na Vercel (preset AIOX `nextjs-react`: React,
  TypeScript, Tailwind), em `coodevelopment.lucas-andrade.dev`. Rotas do
  próprio Next.js para login, amigos, jams, commit e para autenticar o
  conector.
- **Banco:** Postgres (Neon) para usuários, amizades, jams, participantes e
  eventos do feed.
- **Tempo real:** serviço externo, porque a Vercel não segura conexão
  aberta. Decidido pelo @architect (A1): Cloudflare Durable Objects com
  PartyServer, uma sala por jam, que guarda também o estado dos arquivos
  (FR21). Ver `docs/architecture.md`.
- **Conector:** processo Node que roda no PC enquanto a jam está aberta; vigia
  a pasta, fala com o serviço de tempo real e atende os hooks do Claude Code
  localmente. Distribuído como plugin do Claude Code (hooks + servidor MCP)
  instalado pelo próprio conector.
- **Commit:** feito pelo app via API do GitHub, a partir do estado guardado no
  servidor, com o token do criador da jam.
- Sem máquina na nuvem (D10).

### Testing Requirements

Unidade + integração, mais um teste manual guiado:

- **Unidade:** protocolo, regras de sincronização (`.gitignore`, travas de
  caminho, final de linha), montagem da mensagem de commit, regras de
  amizade.
- **Integração:** conector contra um serviço de tempo real de teste com duas
  pastas temporárias (simula dois PCs); hooks chamados com a entrada JSON
  documentada; rotas do app contra um banco de teste (nunca o de produção).
- **Ponta a ponta no navegador:** login simulado, criar jam, página da jam
  recebendo status.
- **Manual:** roteiro "jam a dois" com o Lucas e o pai antes de cada épico
  ser dado como pronto.
- Cada parte testável sozinha pela linha de comando (o conector tem modo de
  diagnóstico).

### Additional Technical Assumptions and Requests

- Hooks escritos em Node (`node script.js`), independentes do shell, porque no
  Windows os hooks podem rodar em PowerShell; o matcher da ferramenta de
  terminal casa `Bash|PowerShell`.
- Bloqueio de edição sem aviso só vale para `Edit`/`Write`/`NotebookEdit`;
  edição por terminal é detectada pelo vigia do conector (lacuna verificada).
- Login do conector por fluxo de dispositivo (código mostrado no terminal e
  confirmado no navegador) **[confirmado]**.
- Segredos fora do git; `vercel env pull` para trazê-los (regra do Lucas).
- Commit e push a cada passo que passa nos testes (regra do Lucas).
- Permissão do GitHub: GitHub App com token de usuário (A4, NFR9). Login
  com Better Auth (A5).

## Epic List

1. **Epic 1: Fundação, login e amigos:** app no ar com login pelo GitHub e
   rede de amigos (busca, pedidos, sugestões de mútuos).
2. **Epic 2: Jams no GitHub:** criar jam importando ou criando repositório,
   chamar amigos como colaboradores e ver a página da jam com quem está nela.
3. **Epic 3: Conector e sincronização ao vivo:** entrar na jam pelo terminal
   (com ajuda para o Node) e ter as mudanças de arquivo chegando ao vivo na
   pasta dos outros, guardadas no servidor.
4. **Epic 4: Claudes coordenados:** status ao vivo de cada Claude, aviso antes
   de mexer, contexto cruzado e alerta de conflito.
5. **Epic 5: Fechar e retomar:** fechar a jam com commit, reabrir com segurança
   e lembrar de trabalho não salvo.

Por que essa ordem: o Epic 3 vem antes do 4 porque o status e os avisos só
fazem sentido com os participantes trabalhando nos mesmos arquivos. Desde o
Epic 3 o estado fica no servidor (FR21), então nada se perde enquanto o
fechamento com commit (Epic 5) não existe. Dá para juntar 4 e 5 se ficarem
pequenos.

## Epic 1 Fundação, login e amigos

Colocar o app no ar no domínio definitivo, com a estrutura do monorepo, e
entregar o primeiro valor real: entrar com o GitHub e montar a rede de
amigos, que é o pré-requisito de qualquer jam.

### Story 1.1 App no ar com a estrutura do monorepo

As a desenvolvedor do Coodevelopment,
I want o monorepo com app web, conector e protocolo criados e o app publicado,
so that toda funcionalidade seguinte já nasça no lugar certo e no ar.

#### Acceptance Criteria

1: O repositório tem o app web, a sala, o conector, o plugin e o protocolo
   (estrutura de `docs/architecture.md`), cada um com o próprio comando de
   teste, e um comando que roda tudo. O CI roda os testes no Windows.
2: O app responde em `coodevelopment.lucas-andrade.dev` com uma página inicial
   que explica o produto em uma frase e um botão de entrar.
3: Uma rota de saúde responde que o app e o banco estão acessíveis.
4: Push na `main` publica na Vercel; segredos ficam fora do git.
5: O conector já roda por `npx` (localmente) e responde `--version`; uma
   versão inicial é publicada no npm para reservar o nome `coodevelopment`.

### Story 1.2 Entrar com o GitHub

As a desenvolvedor,
I want entrar no app com a minha conta do GitHub,
so that eu não precise de outra senha e o app possa agir no meu GitHub.

#### Acceptance Criteria

1: O botão de entrar leva ao GitHub e volta logado.
2: O primeiro login cria o usuário com nome, usuário e foto do GitHub (FR1).
3: O token do GitHub fica só no servidor, cifrado (NFR8).
4: O usuário sai pelo menu; páginas internas exigem login.
5: O login usa o GitHub App com as permissões da arquitetura (NFR9); a
   instalação do app na conta acontece no mesmo passo do login.
6: A renovação do token do GitHub (validade de 8 h) acontece sozinha antes
   de cada chamada.

### Story 1.3 Amigos por busca e pedido

As a usuário,
I want buscar alguém pelo usuário do GitHub e mandar um pedido de amizade,
so that eu possa chamar essa pessoa para uma jam.

#### Acceptance Criteria

1: A busca encontra quem já tem conta no app pelo usuário do GitHub.
2: Enviar pedido cria um pedido pendente visível para os dois.
3: Quem recebe aceita ou recusa; aceitar cria a amizade (FR2).
4: Qualquer um dos dois desfaz a amizade.
5: Não é possível pedir amizade a si mesmo nem duplicar pedido.

### Story 1.4 Sugestões de mútuos do GitHub

As a usuário,
I want ver como sugestão os meus mútuos do GitHub que já usam o app,
so that eu ache meus amigos sem digitar nada.

#### Acceptance Criteria

1: A tela de adicionar amigos lista os mútuos (sigo e me seguem) que têm conta
   no app e ainda não são amigos nem têm pedido pendente (FR3).
2: Cada sugestão tem um botão que manda o pedido; nada vira amizade sem aceite.
3: Mútuos sem conta no app não aparecem.
4: A lista funciona com contas que seguem muita gente (paginação da API do
   GitHub).

## Epic 2 Jams no GitHub

Permitir criar a sala de trabalho a partir de um repositório e reunir os
participantes nele, já com acesso ao código. Ao fim do épico, o Lucas cria uma
jam, chama o pai e os dois veem a mesma página da jam.

### Story 2.1 Criar jam importando um repositório

As a criador,
I want criar uma jam a partir de um repositório meu do GitHub,
so that a gente trabalhe num projeto que já existe.

#### Acceptance Criteria

1: A tela de nova jam lista os repositórios do usuário, com busca (FR4).
2: Escolher um repositório cria a jam com nome, repositório e criador.
3: A jam aparece no Início do criador (FR7).

### Story 2.2 Criar jam com repositório novo

As a criador,
I want criar uma jam já criando um repositório novo na minha conta,
so that a gente comece um projeto do zero.

#### Acceptance Criteria

1: A tela de nova jam permite informar nome e visibilidade do repositório novo.
2: O repositório é criado na conta do criador, com um commit inicial.
3: A jam é criada ligada a ele, como na 2.1.
4: Nome de repositório já existente mostra erro claro, sem criar nada.

### Story 2.3 Chamar amigos para a jam

As a criador,
I want chamar até dois amigos para a jam,
so that eles tenham acesso ao repositório e entrem na sala.

#### Acceptance Criteria

1: Só amigos aparecem para chamar; no máximo 2 (FR5, FR6).
2: Cada chamado vira colaborador do repositório e o convite do GitHub é
   aceito automaticamente em nome dele.
3: A jam aparece no Início de quem foi chamado.
4: Falha no GitHub (por exemplo, limite de colaboradores) mostra erro claro e
   não deixa o participante pela metade.

### Story 2.4 Página da jam

As a participante,
I want abrir a página da jam pelo Início e ver quem está nela,
so that eu acompanhe e gerencie a jam.

#### Acceptance Criteria

1: Cada jam do Início abre a página dela, que mostra o repositório e os
   participantes com foto e nome do GitHub e a situação no repositório (FR8).
2: O criador chama mais amigos pela página, até 3 pessoas, e tenta de novo
   quem não entrou no repositório.
3: Só participantes acessam a página da jam.
4: A página funciona no celular (NFR10).
5: O criador exclui a jam, com confirmação; o repositório no GitHub não é
   tocado.

Dividida em 28/10: o Lucas criou as primeiras jams e não conseguia abrir nem
gerenciar; a presença ao vivo depende da sala na Cloudflare e foi para a 2.5.

### Story 2.5 Presença ao vivo na página da jam

As a participante,
I want ver na página da jam quem está com ela aberta agora,
so that eu saiba com quem estou trabalhando agora.

#### Acceptance Criteria

1: A página mostra quem está com a página aberta agora (FR8).
2: A presença se atualiza sozinha, sem recarregar.
3: A sala da jam (Cloudflare) está publicada pelo CI e só aceita quem tem o
   token emitido pelo app para aquela jam.
4: Sem a sala no ar, a página continua funcionando, sem a presença.

## Epic 3 Conector e sincronização ao vivo

Ligar o PC de cada participante à jam e fazer as mudanças de arquivo
circularem ao vivo, com o estado guardado no servidor. Ao fim do épico, o que
um edita aparece na pasta do outro em até 2 s, e o projeto rodando em cada PC
mostra o trabalho de todos.

### Story 3.1 Entrar na jam pelo conector

As a participante,
I want rodar um comando no terminal para ligar a pasta do projeto à jam,
so that meu PC passe a fazer parte da sala.

#### Acceptance Criteria

1: `npx` com o identificador da jam autentica o usuário sem token colado à mão
   (FR10).
2: Se a pasta do projeto não existe, o conector clona o repositório; se
   existe, confere que é o repositório da jam.
3: A página da jam mostra o participante como "conectado" enquanto o conector
   roda (FR8).
4: O conector tem modo de diagnóstico que diz o que está ligado e o que falta.
5: Funciona no Windows 10 e 11 (NFR4).

### Story 3.2 Passo de conexão com ajuda para o Node

As a participante sem o conector ligado,
I want que a página da jam me diga o que fazer, inclusive se eu não tiver Node,
so that eu entre na jam sem procurar instrução em outro lugar.

#### Acceptance Criteria

1: Enquanto o conector não conectou, a página mostra o aviso de que a jam
   precisa do Node.js (FR9).
2: Há um prompt pronto, com botão de copiar, para mandar ao Claude Code
   instalar o Node e o Git no Windows e confirmar as versões (o conector usa
   o Git para clonar e para respeitar o `.gitignore`).
3: O botão "Já instalei" mostra o comando de entrar, com botão de copiar.
4: Quando o conector conecta, o passo some sozinho.

### Story 3.3 Mudanças de arquivo ao vivo

As a participante,
I want que o que eu mudo chegue na pasta dos outros e o que eles mudam chegue
na minha,
so that o projeto rodando no meu PC mostre o trabalho de todos.

#### Acceptance Criteria

1: Mudança, criação e remoção de arquivo num PC chegam aos outros conectados
   em até 2 s em 95% dos casos (FR17, NFR2).
2: Nada do que o `.gitignore` ignora é enviado (FR17).
3: Arquivo de fora da pasta ou dentro de `.git/` é recusado (FR18).
4: Final de linha é normalizado e não gera mudança falsa nem laço (NFR7).
5: O estado atual dos arquivos fica guardado no servidor; um participante que
   conecta depois recebe a versão atual (FR21).
6: Teste de integração com duas pastas temporárias cobre os itens 1 a 5.

### Story 3.4 Feed de arquivos alterados

As a participante,
I want ver no feed quais arquivos mudaram e quem mudou,
so that eu acompanhe o trabalho mesmo sem olhar a pasta.

#### Acceptance Criteria

1: Cada mudança aparece no feed com autor, arquivo e resumo da diferença
   (FR20).
2: Mudança em arquivo de dependências (detectado por nome comum de cada
   ecossistema) aparece destacada, pedindo reinstalação.
3: O feed agrupa mudanças seguidas do mesmo autor para não virar uma
   enxurrada.
4: O feed se atualiza sozinho e funciona no celular.

## Epic 4 Claudes coordenados

Fazer cada Claude anunciar o que vai fazer, mostrar isso para todos e para os
outros Claudes, e evitar que dois mexam no mesmo arquivo sem saber. É a
feature principal do produto.

### Story 4.1 Plugin do Claude Code e status ao vivo

As a participante,
I want ver quando o Claude de outra pessoa está trabalhando,
so that eu não precise perguntar.

#### Acceptance Criteria

1: Ao entrar na jam, o conector instala ou atualiza o plugin do Claude Code
   (hooks e servidor MCP) para aquela pasta, sem configuração manual (FR11).
   A única interação é aprovar o servidor MCP na primeira vez, e o terminal
   e o passo de conexão avisam disso.
2: Quando o Claude de alguém recebe um prompt, todos veem *"Claude Code de
   {nome} está trabalhando em: ..."* em até 1 s (FR12, NFR1).
3: Quando ele termina, ou para por erro, o status some.
4: Os hooks respondem rápido falando só com o conector local (NFR5).
5: Teste de integração chama os hooks com a entrada JSON documentada.

### Story 4.2 Anunciar antes de mexer

As a participante,
I want que o Claude diga o que vai fazer e em quais arquivos antes de editar,
so that todos saibam o que vem aí.

#### Acceptance Criteria

1: A ferramenta `anunciar(resumo, arquivos)` existe no Claude Code da jam e o
   resumo passa a ser o texto do status (FR13).
2: O aviso aparece no feed com autor, resumo e arquivos.
3: Edição pelas ferramentas de edição do Claude sem aviso ativo é recusada,
   com o motivo devolvido ao Claude (FR14).
4: As instruções da ferramenta pedem para anunciar também antes de comandos
   de terminal que alteram arquivos.
5: Mudança de arquivo detectada sem aviso aparece no feed como "sem aviso"
   (FR19).

### Story 4.3 Contexto cruzado entre os Claudes

As a participante,
I want que o meu Claude saiba o que os outros Claudes estão fazendo,
so that ele não refaça nem desfaça o trabalho deles.

#### Acceptance Criteria

1: A cada prompt, o Claude recebe os avisos ativos dos outros e os arquivos
   reservados (FR15).
2: Durante uma resposta longa, avisos novos dos outros também chegam.
3: O texto chega marcado como informação sobre os outros participantes, não
   como instrução.
4: Sem outros trabalhando, nada é injetado.

### Story 4.4 Alerta de conflito

As a participante,
I want ser avisado quando meu Claude vai mexer num arquivo que outro anunciou,
so that a gente não sobrescreva o trabalho um do outro.

#### Acceptance Criteria

1: Antes de editar arquivo reservado por outro aviso ativo, o Claude é
   avisado de quem reservou e por quê (FR16).
2: A página da jam e o terminal mostram o conflito para as duas pessoas.
3: **[confirmado]** A edição só segue depois de confirmação no terminal de
   quem pediu.
4: A reserva acaba quando o Claude que anunciou termina.

## Epic 5 Fechar e retomar

Transformar o trabalho da jam em commit no GitHub, permitir voltar a ela
depois e garantir que nada fique esquecido no servidor.

### Story 5.1 Fechar a jam com commit

As a participante,
I want fechar a jam e ter tudo commitado no GitHub,
so that o trabalho de todos fique salvo sem merge manual.

#### Acceptance Criteria

1: Qualquer participante fecha a jam (FR22), depois de uma confirmação que
   mostra os arquivos que vão no commit.
2: O commit é feito a partir do estado guardado no servidor, com a mensagem
   montada dos avisos da sessão e os participantes como coautores.
3: O push vai para o repositório da jam, mesmo que o criador não esteja
   conectado (FR23).
4: Falha no push mantém a jam aberta e o estado intacto, com erro claro (NFR3).
5: Depois de fechada, os conectores avisam e param de sincronizar.

### Story 5.2 Reabrir a jam

As a participante,
I want reabrir uma jam fechada,
so that a gente continue de onde parou.

#### Acceptance Criteria

1: Uma jam fechada pode ser reaberta por qualquer participante, a partir do
   último commit (FR25).
2: Ao conectar, se a pasta local estiver diferente da versão da jam, a página
   da jam mostra um popup: atualizar a pasta ou seguir com a versão antiga
   (FR26).
3: Quem segue com a antiga fica só local: nada dele sincroniza até atualizar.
4: Atualizar a pasta nunca apaga arquivo ignorado pelo `.gitignore`.

### Story 5.3 Lembrete de trabalho não salvo

As a participante,
I want ser lembrado quando a jam tem trabalho sem commit há muito tempo,
so that nada fique esquecido no servidor.

#### Acceptance Criteria

1: A página da jam mostra um lembrete quando há trabalho sem commit há mais de
   24 horas **[confirmado]** (FR24).
2: O lembrete tem um atalho para fechar a jam.
3: A jam nunca fecha sozinha (FR23).

## Checklist Results Report

`pm-checklist.md`, modo completo, rodado pelo próprio @pm sobre esta versão.

**Resumo:** PRD cerca de 85% completo; escopo do MVP adequado (19
stories em 5 épicos, sem prazo); **quase pronto para a arquitetura**. As
lacunas são de validação com usuário e de definição técnica que cabem ao
@architect, não de requisito.

| Category | Status | Critical Issues |
|---|---|---|
| 1. Problem Definition & Context | PARTIAL | Sem pesquisa de mercado nem análise de concorrência; impacto não quantificado (ainda não usam juntos) |
| 2. MVP Scope Definition | PASS | Sem prazo, o que é decisão e não falha |
| 3. User Experience Requirements | PARTIAL | Fluxos detalhados ficam para a especificação de front-end |
| 4. Functional Requirements | PASS | Suposições FR16, FR24 e login do conector confirmadas em 23/10 |
| 5. Non-Functional Requirements | PASS | NFR6 com metas sugeridas |
| 6. Epic & Story Structure | PASS | Epic 1 cobre fundação e publicação |
| 7. Technical Guidance | PARTIAL | Serviço de tempo real, algoritmo de sincronização e permissão do GitHub em aberto |
| 8. Cross-Functional Requirements | PARTIAL | Retenção do feed e do estado no servidor não definida; monitoramento não definido |
| 9. Clarity & Communication | PASS | Gerado em YOLO; falta a revisão do Lucas |

**Blockers:** nenhum.

**High:**

- ~~Confirmar as suposições FR16, FR24 e login do conector~~: confirmadas
  pelo Lucas em 23/10.
- @architect: escolher serviço de tempo real e algoritmo de sincronização
  (risco central de NFR2 e NFR3).

**Medium:**

- Definir retenção do feed e do estado dos arquivos guardado no servidor.
- Definir monitoramento mínimo (erros do app e falhas de commit).
- Permissão do GitHub (OAuth App com `repo` ou GitHub App).

**Low:**

- Análise de concorrência (`*create-competitor-analysis`), se o produto for
  aberto além dos amigos.

**Decisão:** NEEDS REFINEMENT leve: pronto para a especificação de front-end e
para a arquitetura em paralelo, com as suposições confirmadas pelo Lucas.

## Next Steps

### Ações do Lucas

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

### UX Expert Prompt

@ux-design-expert: crie `docs/front-end-spec.md` com
`front-end-spec-tmpl.yaml` a partir deste PRD e do `docs/brief.md`. Foco na
página da jam (status ao vivo legível de relance, feed, passo de conexão com o
Node) e na leitura no celular. Visual sóbrio de ferramenta de desenvolvedor,
sem cara de template de IA, textos em português sem travessão.

### Architect Prompt

@architect: crie `docs/fullstack-architecture.md` com
`fullstack-architecture-tmpl.yaml` a partir deste PRD, do brief e de
`docs/research/2026-10-22-hooks-claude-code.md`. Decida serviço de tempo real,
algoritmo de sincronização de arquivos, permissão do GitHub e formato do
plugin do Claude Code; respeite NFR1 a NFR13, em especial qualquer stack
(NFR13) e Windows no conector (NFR4).
