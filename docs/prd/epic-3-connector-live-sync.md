# Epic 3 Conector e sincronização ao vivo

Ligar o PC de cada participante à jam e fazer as mudanças de arquivo
circularem ao vivo, com o estado guardado no servidor. Ao fim do épico, o que
um edita aparece na pasta do outro em até 2 s, e o projeto rodando em cada PC
mostra o trabalho de todos.

## Story 3.1 Entrar na jam pelo conector

As a participante,
I want rodar um comando no terminal para ligar a pasta do projeto à jam,
so that meu PC passe a fazer parte da sala.

### Acceptance Criteria

1: `npx` com o identificador da jam autentica o usuário sem token colado à mão
   (FR10).
2: Se a pasta do projeto não existe, o conector clona o repositório; se
   existe, confere que é o repositório da jam.
3: A página da jam mostra o participante como "conectado" enquanto o conector
   roda (FR8).
4: O conector tem modo de diagnóstico que diz o que está ligado e o que falta.
5: Funciona no Windows 10 e 11 (NFR4).

## Story 3.2 Passo de conexão com ajuda para o Node

As a participante sem o conector ligado,
I want que a página da jam me diga o que fazer, inclusive se eu não tiver Node,
so that eu entre na jam sem procurar instrução em outro lugar.

### Acceptance Criteria

1: Enquanto o conector não conectou, a página mostra o aviso de que a jam
   precisa do Node.js (FR9).
2: Há um prompt pronto, com botão de copiar, para mandar ao Claude Code
   instalar o Node e o Git no Windows e confirmar as versões (o conector usa
   o Git para clonar e para respeitar o `.gitignore`).
3: O botão "Já instalei" mostra o comando de entrar, com botão de copiar.
4: Quando o conector conecta, o passo some sozinho.

## Story 3.3 Mudanças de arquivo ao vivo

As a participante,
I want que o que eu mudo chegue na pasta dos outros e o que eles mudam chegue
na minha,
so that o projeto rodando no meu PC mostre o trabalho de todos.

### Acceptance Criteria

1: Mudança, criação e remoção de arquivo num PC chegam aos outros conectados
   em até 2 s em 95% dos casos (FR17, NFR2).
2: Nada do que o `.gitignore` ignora é enviado (FR17).
3: Arquivo de fora da pasta ou dentro de `.git/` é recusado (FR18).
4: Final de linha é normalizado e não gera mudança falsa nem laço (NFR7).
5: O estado atual dos arquivos fica guardado no servidor; um participante que
   conecta depois recebe a versão atual (FR21).
6: Teste de integração com duas pastas temporárias cobre os itens 1 a 5.

## Story 3.4 Feed de arquivos alterados

As a participante,
I want ver no feed quais arquivos mudaram e quem mudou,
so that eu acompanhe o trabalho mesmo sem olhar a pasta.

### Acceptance Criteria

1: Cada mudança aparece no feed com autor, arquivo e resumo da diferença
   (FR20).
2: Mudança em arquivo de dependências (detectado por nome comum de cada
   ecossistema) aparece destacada, pedindo reinstalação.
3: O feed agrupa mudanças seguidas do mesmo autor para não virar uma
   enxurrada.
4: O feed se atualiza sozinho e funciona no celular.
