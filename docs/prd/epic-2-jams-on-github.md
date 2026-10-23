# Epic 2 Jams no GitHub

Permitir criar a sala de trabalho a partir de um repositório e reunir os
participantes nele, já com acesso ao código. Ao fim do épico, o Lucas cria uma
jam, chama o pai e os dois veem a mesma página da jam.

## Story 2.1 Criar jam importando um repositório

As a criador,
I want criar uma jam a partir de um repositório meu do GitHub,
so that a gente trabalhe num projeto que já existe.

### Acceptance Criteria

1: A tela de nova jam lista os repositórios do usuário, com busca (FR4).
2: Escolher um repositório cria a jam com nome, repositório e criador.
3: A jam aparece no Início do criador (FR7).

## Story 2.2 Criar jam com repositório novo

As a criador,
I want criar uma jam já criando um repositório novo na minha conta,
so that a gente comece um projeto do zero.

### Acceptance Criteria

1: A tela de nova jam permite informar nome e visibilidade do repositório novo.
2: O repositório é criado na conta do criador, com um commit inicial.
3: A jam é criada ligada a ele, como na 2.1.
4: Nome de repositório já existente mostra erro claro, sem criar nada.

## Story 2.3 Chamar amigos para a jam

As a criador,
I want chamar até dois amigos para a jam,
so that eles tenham acesso ao repositório e entrem na sala.

### Acceptance Criteria

1: Só amigos aparecem para chamar; no máximo 2 (FR5, FR6).
2: Cada chamado vira colaborador do repositório e o convite do GitHub é
   aceito automaticamente em nome dele.
3: A jam aparece no Início de quem foi chamado.
4: Falha no GitHub (por exemplo, limite de colaboradores) mostra erro claro e
   não deixa o participante pela metade.

## Story 2.4 Página da jam com presença

As a participante,
I want abrir a página da jam e ver quem está nela e quem está online,
so that eu saiba com quem estou trabalhando agora.

### Acceptance Criteria

1: A página mostra o repositório, os participantes com foto e nome do GitHub
   e quem está com a página aberta agora (FR8).
2: A presença se atualiza sozinha, sem recarregar.
3: Só participantes acessam a página da jam.
4: A página funciona no celular (NFR10).
5: A sala da jam (Cloudflare) está publicada pelo CI e só aceita quem tem o
   token emitido pelo app para aquela jam.
