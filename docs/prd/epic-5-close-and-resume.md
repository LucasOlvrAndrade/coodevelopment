# Epic 5 Fechar e retomar

Transformar o trabalho da jam em commit no GitHub, permitir voltar a ela
depois e garantir que nada fique esquecido no servidor.

## Story 5.1 Fechar a jam com commit

As a participante,
I want fechar a jam e ter tudo commitado no GitHub,
so that o trabalho de todos fique salvo sem merge manual.

### Acceptance Criteria

1: Qualquer participante fecha a jam (FR22), depois de uma confirmação que
   mostra os arquivos que vão no commit.
2: O commit é feito a partir do estado guardado no servidor, com a mensagem
   montada dos avisos da sessão e os participantes como coautores.
3: O push vai para o repositório da jam, mesmo que o criador não esteja
   conectado (FR23).
4: Falha no push mantém a jam aberta e o estado intacto, com erro claro (NFR3).
5: Depois de fechada, os conectores avisam e param de sincronizar.

## Story 5.2 Reabrir a jam

As a participante,
I want reabrir uma jam fechada,
so that a gente continue de onde parou.

### Acceptance Criteria

1: Uma jam fechada pode ser reaberta por qualquer participante, a partir do
   último commit (FR25).
2: Ao conectar, se a pasta local estiver diferente da versão da jam, a página
   da jam mostra um popup: atualizar a pasta ou seguir com a versão antiga
   (FR26).
3: Quem segue com a antiga fica só local: nada dele sincroniza até atualizar.
4: Atualizar a pasta nunca apaga arquivo ignorado pelo `.gitignore`.

## Story 5.3 Lembrete de trabalho não salvo

As a participante,
I want ser lembrado quando a jam tem trabalho sem commit há muito tempo,
so that nada fique esquecido no servidor.

### Acceptance Criteria

1: A página da jam mostra um lembrete quando há trabalho sem commit há mais de
   24 horas **[confirmado]** (FR24).
2: O lembrete tem um atalho para fechar a jam.
3: A jam nunca fecha sozinha (FR23).
