# Project Brief: Coodevelopment

Versão 1.0 (rascunho), 2026-10-22. Base: `docs/decisoes.md` (D1 a D7).

## 1. Resumo

Coodevelopment é um app web onde até três pessoas desenvolvem o mesmo projeto
juntas, cada uma com o seu Claude Code, dentro de uma **jam**: uma sala ligada a
um repositório do GitHub, com uma máquina na nuvem rodando o projeto. O que
diferencia o produto é o **contexto em tempo real**: cada um vê, na hora, o que
o Claude do outro vai fazer e está fazendo, e o preview do projeto se atualiza
sozinho a cada mudança. Ninguém instala nada; tudo roda no navegador.

## 2. Problema

Hoje, duas pessoas usando o Claude Code no mesmo projeto trabalham às cegas:

- Cada uma roda o Claude na própria máquina e só descobre o que a outra mudou
  depois de um push, muitas vezes com conflito.
- O Claude de uma pessoa não sabe o que o Claude da outra está fazendo, então
  os dois podem reescrever o mesmo arquivo em direções opostas.
- Ver o resultado exige puxar o código e rodar localmente, o que trava quem não
  tem ambiente montado (caso do pai do Lucas).
- Esquecer de commitar ou de dar push faz o trabalho se perder.

## 3. Solução

- **Jam:** criada a partir de um repositório do GitHub do criador, importado
  ou novo. Os amigos convidados entram como colaboradores do repo
  automaticamente.
- **Máquina na nuvem por jam:** repo clonado, servidor de desenvolvimento
  rodando e um Claude Code para cada participante.
- **Aviso antes de mexer:** a cada prompt, o Claude daquela pessoa anuncia que
  vai trabalhar e resume o que vai mudar e em quais arquivos. O aviso aparece
  para os outros e entra no contexto dos outros Claudes.
- **Preview ao vivo:** o projeto rodando, ao lado do chat, atualizando a cada
  edição.
- **Salvar sem pensar:** ao fechar a jam (ou se ela fechar sozinha), tudo é
  commitado e enviado ao GitHub.

## 4. Usuários

**Primário (MVP):** o Lucas, desenvolvedor, que já usa o Claude Code no dia a
dia e quer desenvolver junto com o pai.

**Secundário (MVP):** o pai do Lucas, que participa das jams pelo navegador,
sem ambiente local. Precisa de uma interface clara, que não exija conhecer git
ou terminal.

**Futuro:** amigos e pequenos grupos (até 3) que queiram programar juntos com o
Claude.

## 5. Objetivos e métricas

| Objetivo | Como medir |
|---|---|
| Codesenvolver sem conflito surpresa | Nenhuma edição simultânea do mesmo arquivo sem aviso prévio na tela |
| Sensação de tempo real | Aviso do outro Claude aparece em menos de 1 s; preview reflete a edição em poucos segundos |
| Nunca perder trabalho | 100% das jams fechadas (manual ou automaticamente) terminam com commit e push |
| Usável por quem não programa | O pai do Lucas cria um pedido e vê o resultado no preview sem ajuda |
| Começar rápido | Da criação da jam ao preview no ar em poucos minutos |

## 6. Escopo do MVP

**Entra:**

1. Login com GitHub.
2. Amigos: adicionar pelo usuário do GitHub, aceitar, remover.
3. Criar jam: importar repo existente do criador ou criar um novo; convidar até
   2 amigos; convite de colaborador no GitHub aceito automaticamente.
4. Abrir jam: sobe a máquina na nuvem, clona o repo, instala dependências,
   liga o servidor de desenvolvimento.
5. Tela da jam: o seu chat com o Claude, o feed ao vivo do que cada Claude está
   fazendo (avisos, arquivos alterados), o preview do projeto e quem está online.
6. Uma sessão do Claude por pessoa, com o aviso obrigatório antes de editar e
   alerta quando dois Claudes vão mexer no mesmo arquivo.
7. Fechar jam: commit e push no repositório; também ao ficar ociosa ou antes
   da máquina expirar.
8. Reabrir jam: volta de onde parou.
9. Chave do Claude única (do Lucas), guardada fora da máquina da jam.
10. Interface responsiva e polida, utilizável também no celular para
    acompanhar.

**Fica fora do MVP:**

- Limites de uso e cobrança por pessoa (D7).
- Mais de 3 pessoas por jam (D6).
- Commits intermediários, branches e pull requests pela interface.
- Editor de código manual no navegador (a edição é via Claude).
- Deploy do projeto da jam em produção.
- Chave própria do Claude por usuário.

## 7. Visão pós-MVP

- Histórico da jam: linha do tempo dos pedidos e mudanças de cada um.
- Limite de uso por pessoa, se o grupo crescer.
- Deploy de preview público para mostrar a jam a quem não participa.
- Mais participantes e papéis (quem pode pedir, quem só assiste).

## 8. Considerações técnicas

Detalhadas em `docs/decisoes.md`; o resumo:

- **App:** Next.js na Vercel, em `coodevelopment.lucas-andrade.dev`.
- **Banco:** Postgres (Neon) para usuários, amizades, jams e eventos.
- **Máquina da jam:** Vercel Sandbox, com Claude Agent SDK e o servidor de
  desenvolvimento do projeto exposto para o preview.
- **Tempo real:** conexão ao vivo servida pela própria máquina da jam, com
  acesso por token curto assinado pelo app.
- **Chave do Claude:** fica no app; a máquina da jam fala com o Claude por um
  proxy do app.
- **GitHub:** OAuth com permissão de repositório para criar repo, convidar e
  aceitar convites; o push é feito pelo app, não pelo Claude.

## 9. Restrições e premissas

- Custo de máquina e de Claude todo na conta do Lucas; aceito porque o uso
  inicial é de duas pessoas.
- Todos os participantes precisam de conta no GitHub.
- A máquina na nuvem tem tempo máximo de vida; a jam precisa sobreviver a isso
  (salvar e restaurar).
- Projetos da jam devem rodar com um servidor de desenvolvimento web (Node no
  MVP).

## 10. Riscos e perguntas

| Risco | Mitigação |
|---|---|
| Dois Claudes editando o mesmo arquivo | Aviso obrigatório, reserva de arquivo e alerta antes de editar |
| Claude de um participante lendo segredos (chave, tokens) | Chave e tokens nunca ficam na máquina da jam |
| Máquina expira no meio do trabalho | Commit automático antes de desligar e restauração ao reabrir |
| Custo da máquina ligada à toa | Desligar a jam ociosa (com commit) |
| Repo com instalação pesada ou que não roda | Mostrar o log de instalação e de erro na tela; MVP focado em projetos Node |

**Perguntas para o PRD:**

1. Tempo de ociosidade até a jam fechar sozinha.
2. O que acontece quando o criador sai e os outros continuam.
3. Mensagem do commit ao fechar: gerada pelo Claude a partir dos avisos ou
   fixa.
