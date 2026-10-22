# Project Brief: Coodevelopment

Template `project-brief-tmpl.yaml` v2.0, modo interativo. Base:
`docs/decisoes.md` (D2, D4 a D7, D9 a D11). Em construção, seção por seção.

## Executive Summary

**Coodevelopment** é um app web em que até três desenvolvedores trabalham
juntos no mesmo projeto, cada um com o próprio Claude Code no próprio PC,
dentro de uma **jam**: uma sala ligada a um repositório do GitHub que mantém
os participantes sincronizados ao vivo, em projetos de qualquer stack.

**Problema:** quem já programa com o Claude Code, como o Lucas e o pai dele,
trabalha em paralelo às cegas. Cada um roda o próprio Claude, que não sabe o
que o outro Claude está fazendo; um só descobre as mudanças do outro depois do
push, muitas vezes com conflito, e para ver o resultado do outro precisa puxar
o código e rodar na própria máquina.

**Público:** desenvolvedores que já usam o Claude Code e querem construir algo
juntos. De início, o Lucas e o pai dele; depois, amigos e pequenos grupos.

**Proposta de valor:** contexto em tempo real. Antes de mexer em qualquer
coisa, o Claude de cada pessoa anuncia o que vai mudar, e esse aviso chega na
hora à tela dos outros e ao contexto dos outros Claudes. O projeto rodando na
máquina de cada um se atualiza com as mudanças de todos. Ao fechar a jam, o
trabalho vai sozinho para o GitHub, sem conflito para resolver depois.

## Problem Statement

**Como é hoje.** O Lucas e o pai programam com o Claude Code, cada um no seu
PC. Agora querem **construir juntos, ao mesmo tempo**, nos mesmos projetos, de
qualquer stack. Hoje eles não têm como fazer isso:

- **Ninguém sabe se o Claude do outro está trabalhando agora, nem em quê.** O
  status de uma sessão do Claude Code só aparece no terminal de quem a abriu.
- **Os Claudes trabalham às cegas.** O Claude de um não sabe o que o do outro
  está fazendo; os dois podem mexer no mesmo arquivo ou resolver o mesmo
  problema de jeitos opostos.
- **As mudanças só aparecem depois do push.** O conflito é descoberto tarde,
  quando já tem trabalho em cima dele.
- **Para ver o trabalho do outro rodando, é preciso puxar e reiniciar**; em
  projetos com banco e variáveis de ambiente, isso pesa ainda mais.
- **A coordenação fica por fora,** em mensagem ou ligação, e o Claude não
  recebe nada disso.

O resultado é que trabalhar junto vira **trabalhar em turnos**: um mexe, o
outro espera.

**Impacto.** Ainda não medido, porque eles ainda não começaram. O custo
esperado é tempo de espera entre turnos, conflitos de merge gerados por dois
agentes e retrabalho. O MVP deve medir isso nas primeiras jams reais (ver
Goals & Success Metrics).

**Por que as soluções atuais não resolvem.**

- **Git com branches e PRs:** assíncrono; junta o trabalho depois, não durante.
- **Compartilhar tela:** só um pilota por vez; o outro Claude fica de fora.
- **Editores colaborativos (ex.: VS Code Live Share):** compartilham código,
  mas não mostram o que cada Claude está fazendo, e nenhum Claude sabe do outro.
- **Ambientes no navegador (ex.: StackBlitz):** não rodam qualquer stack; um
  projeto com Postgres via `pg` (TCP), por exemplo, não funciona lá.
- **O Claude Code em si:** cada sessão é de uma pessoa só.

**Por que agora.** Os agentes de código já fazem boa parte do trabalho; o
gargalo de quem programa junto passou a ser coordenar os agentes.

## Proposed Solution

**Conceito.** O Coodevelopment não substitui nada do que os participantes já
usam: Claude Code, editor, terminal e o jeito de rodar o projeto continuam
iguais. Ele acrescenta **uma camada de coordenação entre os Claudes**, em três
partes:

1. **A jam (app web).** Quem cria escolhe o repositório do GitHub (importa um
   existente ou cria um novo) e chama até dois amigos, que viram colaboradores
   automaticamente. A página da jam mostra quem está dentro, o **status ao vivo
   de cada Claude** (*"Claude Code de Lucas está trabalhando em: ..."*) e um
   feed com avisos, arquivos alterados e ações importantes (instalou pacote,
   rodou migração).
2. **O conector local.** Cada participante roda um comando no próprio PC para
   entrar na jam com a pasta do projeto. A partir daí:
   - o Claude Code passa a **anunciar** o que vai fazer antes de mexer;
   - a cada prompt, o Claude **recebe o que os outros Claudes estão fazendo
     agora**;
   - antes de editar um arquivo que outro Claude anunciou, ele **é avisado do
     conflito**;
   - as mudanças de cada um **chegam ao vivo na pasta dos outros**, e o projeto
     rodando localmente se atualiza sozinho: esse é o preview.
3. **O fechamento.** Quando qualquer participante fecha a jam, o trabalho de
   todos vira um commit no repositório, sem merge para resolver depois. A jam
   nunca fecha sozinha; até alguém fechar, o estado fica guardado no servidor.

**Diferenciais.**

- **Coordena agentes, não só pessoas.** Editores colaborativos sincronizam
  texto; o Coodevelopment faz cada Claude saber o que os outros estão fazendo.
- **Usa o Claude Code de verdade,** com a assinatura, configurações, skills e
  memória de cada um.
- **Qualquer stack,** porque cada projeto roda onde já roda hoje.
- **Sem servidor de projeto para manter:** nenhuma máquina na nuvem ligada.

**Por que vai funcionar.** Mudança mínima de hábito: entrar na jam e continuar
trabalhando como antes. Apoia-se em pontos de extensão que o Claude Code já
oferece (hooks e MCP), em vez de reimplementar o agente.

**Visão.** Ser a "sala de trabalho" de quem constrói software junto com
agentes de IA: o mesmo projeto, vários Claudes, todo mundo sabendo o que está
acontecendo.

## Target Users

### Primary User Segment: dupla de desenvolvedores que já usa Claude Code (Lucas e o pai)

- **Perfil:** dois desenvolvedores da mesma família, cada um com o próprio PC e
  o próprio Claude Code. Os dois trabalham no Windows. Os dois já mantêm
  projetos rodando localmente, com banco e variáveis de ambiente.
- **Como trabalham hoje:** cada um sozinho, no próprio projeto, conversando com
  o próprio Claude. Ainda não trabalharam juntos no mesmo código ao mesmo tempo.
- **Necessidades e dores:** saber na hora o que o Claude do outro está fazendo;
  evitar que os dois Claudes mexam no mesmo arquivo; ver o trabalho do outro
  rodando sem puxar e reiniciar; não perder nada ao encerrar.
- **Objetivo:** construir juntos os projetos deles, de qualquer stack, rápido e
  sem trabalhar em turnos.

### Secondary User Segment: pequenos grupos de amigos desenvolvedores

- **Perfil:** 2 a 3 desenvolvedores (D6) que usam Claude Code e se conhecem;
  entram por convite de amizade no app.
- **Como trabalham hoje:** projetos paralelos ou de fim de semana, coordenados
  por mensagem, cada um no seu branch.
- **Necessidades e dores:** as mesmas do segmento principal, com mais
  variedade de stacks e de sistemas operacionais.
- **Objetivo:** construir algo junto numa sessão combinada (uma "jam"), como um
  hackathon pequeno.

## Goals & Success Metrics

### Business Objectives

- **Primeiro uso real:** o Lucas e o pai fazem a primeira jam de verdade num
  projeto deles, com os dois Claude Code trabalhando ao mesmo tempo, assim que
  o MVP estiver no ar.
- **Trabalhar junto sem turnos:** os projetos que os dois tocam juntos passam
  a ser feitos majoritariamente dentro de jams.
- **Qualquer stack (D11):** jams funcionando em pelo menos dois projetos de
  stacks diferentes sem mudar nada no Coodevelopment.

### User Success Metrics

- Cada um sabe, sem perguntar, se o Claude do outro está trabalhando e em quê.
- Os Claudes trabalham ao mesmo tempo, em vez de um esperar o outro.
- Nenhum trabalho se perde ao fechar a jam.
- Ninguém precisa resolver conflito de merge depois de uma jam.

### Key Performance Indicators (KPIs)

- **Latência do status:** do Claude começar a trabalhar ao *"está trabalhando
  em: ..."* aparecer para os outros. Meta: até 1 s em 95% dos casos.
- **Latência da sincronização:** de um arquivo mudar num PC a chegar na pasta
  dos outros. Meta: até 2 s em 95% dos casos.
- **Jams salvas:** jams fechadas que terminam com commit e push. Meta: 100%.
- **Conflitos sem aviso:** edições simultâneas do mesmo arquivo sem aviso
  prévio. Meta: zero.
- **Simultaneidade:** parte do tempo de jam com dois ou mais Claudes
  trabalhando ao mesmo tempo. Meta inicial: acima de 50%, revisar depois das
  primeiras jams.

## MVP Scope

### Core Features (Must Have)

- **Login com GitHub:** identidade e permissão para criar repositório e
  convidar colaborador.
- **Amigos (D12):** na tela de adicionar amigos, os mútuos do GitHub que já
  têm conta no Coodevelopment aparecem como sugestões; busca pelo usuário do
  GitHub para os demais. Adicionar manda pedido de amizade (aceitar ou
  recusar); ninguém vira amigo automaticamente. Remover amigo. Só amigos podem
  ser chamados para uma jam.
- **Criar jam:** importar um repositório do criador ou criar um novo (D4),
  chamar até 2 amigos (D6), convite de colaborador aceito automaticamente.
- **Conector local para Windows:** um comando `npx` para entrar na jam com a
  pasta do projeto (clona o repositório se a pasta não existir) e ligar o
  Claude Code à jam por hooks e MCP, sem configuração manual.
- **Ajuda para quem não tem Node (D13):** ao entrar na jam, a página avisa que
  ela precisa do Node.js, oferece um prompt pronto para copiar e mandar ao
  Claude Code instalar, e um botão "Já instalei" que mostra o comando de
  entrar e espera o conector conectar.
- **Status ao vivo (D9):** *"Claude Code de Lucas está trabalhando em: ..."*
  para todos, sumindo quando ele termina.
- **Aviso antes de mexer (D2):** o Claude anuncia resumo e arquivos antes de
  editar.
- **Contexto cruzado:** a cada prompt, o Claude recebe o que os outros Claudes
  estão fazendo agora.
- **Alerta de conflito:** antes de editar um arquivo anunciado por outro
  Claude, o Claude e a pessoa são avisados.
- **Sincronização ao vivo:** mudanças de arquivo chegam na pasta dos outros,
  respeitando o `.gitignore`; dependências, build e `.env` nunca vão (D11).
- **Feed da jam:** avisos, arquivos alterados e ações que afetam os outros
  (ex.: dependências que mudaram e precisam ser reinstaladas).
- **Fechar jam com commit (D5, D14, D15):** qualquer participante fecha; commit
  e push com mensagem montada a partir dos avisos da sessão. A jam nunca fecha
  sozinha, e continua se o criador sair.
- **Reabrir jam (D17):** voltar a trabalhar a partir do último commit; se a
  pasta local de alguém estiver diferente, um popup pergunta se ele quer
  atualizá-la ou seguir com a versão mais antiga; seguindo com a antiga, ele
  fica só local (nada sincroniza) até atualizar.
- **Lembrete de trabalho não salvo (D20):** a jam avisa quando tem trabalho sem
  commit há muito tempo.
- **Página da jam polida e responsiva:** no computador e no celular.

### Out of Scope for MVP

- Conector para macOS e Linux.
- Limites de uso e cobrança (D7).
- Mais de 3 pessoas por jam (D6).
- Preview do projeto embutido na página da jam.
- Branches, pull requests e commits intermediários pela interface.
- Editor de código no navegador.
- Deploy do projeto da jam.
- Status dos outros dentro do terminal (barra de status do Claude Code).

### MVP Success Criteria

O Lucas e o pai fazem uma jam inteira num projeto real deles, com os dois
Claude Code trabalhando ao mesmo tempo: durante toda a sessão cada um vê o
status do outro, nenhum conflito acontece sem aviso, e a jam termina com tudo
commitado, sem merge manual. O mesmo funciona em um segundo projeto de stack
diferente.

## Post-MVP Vision

### Phase 2 Features

- **Conector para macOS e Linux,** para os amigos (segmento secundário).
- **Status dos outros no terminal,** na barra de status do Claude Code.
- **Linha do tempo da jam:** histórico de quem pediu o quê ao próprio Claude,
  quais arquivos cada um mexeu e quando, para retomar a jam no dia seguinte.
- **Mais controle sobre o git:** commits intermediários durante a jam e opção
  de fechar a jam como pull request em vez de commit direto.
- **Preview compartilhado opcional:** o dono da jam expõe o projeto rodando no
  PC dele para os outros verem no navegador.

### Long-term Vision

Ser o lugar onde pequenos grupos constroem software junto com agentes de IA:
abrir uma jam, chamar quem precisa e trabalhar ao mesmo tempo, com cada agente
sabendo o que os outros estão fazendo.

### Expansion Opportunities

- **Grupos maiores e papéis:** mais de 3 pessoas, com papéis (quem pilota,
  quem acompanha).
- **Outros agentes de código:** a mesma coordenação para outras ferramentas
  além do Claude Code (hipótese: depende de elas terem hooks equivalentes).
- **Uso comercial:** equipes pequenas e empresas, com limites e cobrança.

## Technical Considerations

Ideias iniciais, não decisões; a escolha final é do @architect.

### Platform Requirements

- **Target Platforms:** app web (página da jam, amigos, login) e conector
  local para **Windows** no MVP (os dois usuários usam Windows).
- **Browser/OS Support:** navegadores atuais no computador e no celular; a
  página da jam precisa funcionar bem no celular para acompanhar. O conector
  exige Node.js (D13).
- **Performance Requirements:** status em até 1 s e arquivos em até 2 s, em
  95% dos casos (Goals & Success Metrics). O conector não pode pesar no PC
  enquanto o projeto e o Claude Code rodam.

### Technology Preferences

- **Frontend:** Next.js na Vercel, em `coodevelopment.lucas-andrade.dev`.
- **Backend:** rotas do próprio Next.js (login, amigos, jams, commit) mais um
  **serviço de tempo real** externo (Liveblocks, PartyKit, Ably ou similar),
  porque a Vercel não segura conexão aberta.
- **Database:** Postgres (Neon) para usuários, amizades, jams e eventos; o
  estado dos arquivos da jam no serviço de tempo real ou no banco, a definir.
- **Hosting/Infrastructure:** Vercel + Neon + serviço de tempo real; conector
  publicado como pacote `npx` (D13). Sem máquina na nuvem (D10).

### Architecture Considerations

- **Repository Structure:** monorepo com o app web, o conector local e um
  pacote compartilhado com o protocolo (mensagens de status, aviso e arquivo),
  para os dois lados nunca divergirem.
- **Service Architecture:** app na Vercel, serviço de tempo real e Neon; o
  conector em cada PC liga Claude Code e pasta do projeto ao serviço.
- **Integration Requirements:** GitHub (OAuth; repositórios, colaboradores e
  convites; mútuos para sugestões, D12; commit via API ao fechar, com os
  participantes como coautores). Claude Code (hooks ao enviar prompt, antes e
  depois de usar ferramenta e ao terminar; servidor MCP com `anunciar`).
- **Security/Compliance:** token do GitHub só no servidor, cifrado; o conector
  faz login na conta do usuário, nunca com token colado à mão; o conector
  **recusa arquivo de fora da pasta do projeto ou dentro de `.git/`** (senão um
  participante plantaria, por exemplo, um hook do git no PC do outro); `.env` e
  o que está no `.gitignore` nunca saem do PC; avisos dos outros entram no
  contexto do Claude marcados como informação, não como instrução.

## Constraints & Assumptions

### Constraints

- **Budget:** projeto pessoal, sem receita; tem de caber nos planos que o Lucas
  já usa (Vercel, Neon) mais o plano gratuito ou mais barato do serviço de
  tempo real. O Claude não custa nada ao app: cada um usa a própria assinatura
  (D10).
- **Timeline:** sem prazo.
- **Resources:** o Lucas desenvolve com Claude Code e os agentes do AIOX; o pai
  é o primeiro testador real.
- **Technical:** conector só Windows no MVP; Node.js obrigatório no PC (D13);
  dependência dos hooks e do MCP do Claude Code; conta no GitHub para todos;
  a Vercel não segura conexão aberta (serviço de tempo real externo); cada
  participante precisa ter o projeto rodando no próprio PC (o Coodevelopment
  não instala dependências, banco nem `.env`).

### Key Assumptions

- Todo participante tem Claude Code com assinatura própria.
- O pai tem Node.js instalado; se não tiver, o fluxo da D13 resolve.
- Os hooks e o MCP do Claude Code permitem o que o MVP precisa: saber quando o
  Claude começa e termina, injetar contexto a cada prompt e interceptar uma
  edição antes de ela acontecer.
- Os projetos das jams cabem numa sincronização ao vivo (repositórios de
  código; binários grandes ficam no `.gitignore` ou fora da jam).
- A internet dos participantes aguenta sincronização ao vivo por horas.
- Os participantes de uma jam confiam uns nos outros (amigos que se
  aceitaram); o MVP não se protege de participante mal-intencionado além das
  travas de Technical Considerations.
- Os mútuos do GitHub são uma boa aproximação de quem a pessoa quer chamar.

## Risks & Open Questions

### Key Risks

- **Hooks do Claude Code não bastarem:** sem injetar contexto a cada prompt ou
  interceptar edição antes de acontecer, a feature principal fica pela metade.
  Risco que derruba o produto; primeiro a verificar.
- **O Claude não chamar `anunciar`:** o modelo pode pular a ferramenta e
  editar direto. Mitigação proposta: o hook antes da edição recusa mexer em
  arquivo sem aviso ativo.
- **Escrita simultânea no mesmo arquivo:** dois PCs gravando ao mesmo tempo
  podem fazer uma mudança sobrescrever a outra; a sincronização tem de
  garantir que nada se perca.
- **Final de linha no Windows:** CRLF num PC e LF no outro geram "mudanças"
  falsas, ruído ou loop; o conector precisa normalizar.
- **Ações fora dos arquivos:** migração, instalação de pacote e testes em banco
  compartilhado acontecem num PC e afetam os outros; precisam ir para o feed.
- **Mudança na interface do Claude Code:** atualização de hooks ou MCP pode
  quebrar o conector.
- **Custo ou limite do serviço de tempo real:** horas de jam podem passar do
  plano gratuito.
- **Permissão ampla no GitHub:** criar repo e convidar colaborador pede acesso
  a todos os repositórios privados do usuário.
- **Jam aberta indefinidamente (D14):** como a jam não fecha sozinha, trabalho
  pode ficar dias só no servidor, sem chegar ao GitHub. Mitigação: lembrete de
  trabalho não salvo (D20).

### Open Questions

- Depois de quanto tempo sem commit o lembrete da D20 aparece (para o PRD).

### Areas Needing Further Research

- Interface atual de hooks e MCP do Claude Code: o que dá para injetar,
  interceptar e bloquear (**primeiro**).
- Serviço de tempo real: Liveblocks, PartyKit, Ably e outros em latência,
  preço e armazenamento de estado.
- Algoritmo de sincronização de arquivos: CRDT ou reserva de arquivo com
  última escrita vence.
- Permissões mínimas do GitHub para criar repo, convidar e commitar; se um
  GitHub App reduz o acesso pedido.
- Vigia de arquivos no Windows: desempenho em pastas grandes e respeito ao
  `.gitignore`.
