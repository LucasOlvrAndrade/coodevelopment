# Requirements

## Functional

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

## Non Functional

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
