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
3. **O fechamento.** Ao fechar a jam, ou quando ela fecha sozinha, o trabalho
   de todos vira um commit no repositório, sem merge para resolver depois.

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
- **Jams salvas:** jams fechadas (manual ou automaticamente) que terminam com
  commit e push. Meta: 100%.
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
- **Conector local para Windows:** um comando para entrar na jam com a pasta do
  projeto (clona o repositório se a pasta não existir) e ligar o Claude Code à
  jam por hooks e MCP, sem configuração manual.
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
- **Fechar jam com commit (D5):** commit e push ao fechar e quando a jam fecha
  sozinha (todos saíram ou ociosa).
- **Reabrir jam:** voltar a trabalhar a partir do último commit.
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
