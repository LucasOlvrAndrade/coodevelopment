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
PC. Agora precisam **construir juntos, ao mesmo tempo**, o sistema de backup do
projeto RBC: o Lucas desenvolveu a plataforma e o pai vai ajudar na
implementação. Hoje eles não têm como fazer isso:

- **Ninguém sabe se o Claude do outro está trabalhando agora, nem em quê.** O
  status de uma sessão do Claude Code só aparece no terminal de quem a abriu.
- **Os Claudes trabalham às cegas.** O Claude de um não sabe o que o do outro
  está fazendo; os dois podem mexer no mesmo arquivo ou resolver o mesmo
  problema de jeitos opostos.
- **As mudanças só aparecem depois do push.** O conflito é descoberto tarde,
  quando já tem trabalho em cima dele.
- **Para ver o trabalho do outro rodando, é preciso puxar e reiniciar**; no RBC
  isso inclui banco e variáveis de ambiente.
- **A coordenação fica por fora,** em mensagem ou ligação, e o Claude não
  recebe nada disso.

O resultado é que trabalhar junto vira **trabalhar em turnos**: um mexe, o
outro espera.

**Impacto.** Ainda não medido, porque eles ainda não começaram. O custo
esperado é tempo de espera entre turnos, conflitos de merge gerados por dois
agentes e retrabalho. O MVP deve medir isso no uso real do RBC (ver Goals &
Success Metrics).

**Por que as soluções atuais não resolvem.**

- **Git com branches e PRs:** assíncrono; junta o trabalho depois, não durante.
- **Compartilhar tela:** só um pilota por vez; o outro Claude fica de fora.
- **Editores colaborativos (ex.: VS Code Live Share):** compartilham código,
  mas não mostram o que cada Claude está fazendo, e nenhum Claude sabe do outro.
- **Ambientes no navegador (ex.: StackBlitz):** não rodam qualquer stack; o
  RBC, com Postgres via `pg` (TCP), não funciona lá.
- **O Claude Code em si:** cada sessão é de uma pessoa só.

**Por que agora.** Os agentes de código já fazem boa parte do trabalho; o
gargalo de quem programa junto passou a ser coordenar os agentes. E há um
projeto real esperando por isso.

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
- **Objetivo:** implementar juntos o sistema de backup do RBC, rápido e sem
  trabalhar em turnos.

### Secondary User Segment: pequenos grupos de amigos desenvolvedores

- **Perfil:** 2 a 3 desenvolvedores (D6) que usam Claude Code e se conhecem;
  entram por convite de amizade no app.
- **Como trabalham hoje:** projetos paralelos ou de fim de semana, coordenados
  por mensagem, cada um no seu branch.
- **Necessidades e dores:** as mesmas do segmento principal, com mais
  variedade de stacks e de sistemas operacionais.
- **Objetivo:** construir algo junto numa sessão combinada (uma "jam"), como um
  hackathon pequeno.
