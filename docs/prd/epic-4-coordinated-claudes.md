# Epic 4 Claudes coordenados

Fazer cada Claude anunciar o que vai fazer, mostrar isso para todos e para os
outros Claudes, e evitar que dois mexam no mesmo arquivo sem saber. É a
feature principal do produto.

## Story 4.1 Plugin do Claude Code e status ao vivo

As a participante,
I want ver quando o Claude de outra pessoa está trabalhando,
so that eu não precise perguntar.

### Acceptance Criteria

1: Ao entrar na jam, o conector instala ou atualiza o plugin do Claude Code
   (hooks e servidor MCP) para aquela pasta, sem configuração manual (FR11).
   A única interação é aprovar o servidor MCP na primeira vez, e o terminal
   e o passo de conexão avisam disso.
2: Quando o Claude de alguém recebe um prompt, todos veem *"Claude Code de
   {nome} está trabalhando em: ..."* em até 1 s (FR12, NFR1).
3: Quando ele termina, ou para por erro, o status some.
4: Os hooks respondem rápido falando só com o conector local (NFR5).
5: Teste de integração chama os hooks com a entrada JSON documentada.

## Story 4.2 Anunciar antes de mexer

As a participante,
I want que o Claude diga o que vai fazer e em quais arquivos antes de editar,
so that todos saibam o que vem aí.

### Acceptance Criteria

1: A ferramenta `anunciar(resumo, arquivos)` existe no Claude Code da jam e o
   resumo passa a ser o texto do status (FR13).
2: O aviso aparece no feed com autor, resumo e arquivos.
3: Edição pelas ferramentas de edição do Claude sem aviso ativo é recusada,
   com o motivo devolvido ao Claude (FR14).
4: As instruções da ferramenta pedem para anunciar também antes de comandos
   de terminal que alteram arquivos.
5: Mudança de arquivo detectada sem aviso aparece no feed como "sem aviso"
   (FR19).

## Story 4.3 Contexto cruzado entre os Claudes

As a participante,
I want que o meu Claude saiba o que os outros Claudes estão fazendo,
so that ele não refaça nem desfaça o trabalho deles.

### Acceptance Criteria

1: A cada prompt, o Claude recebe os avisos ativos dos outros e os arquivos
   reservados (FR15).
2: Durante uma resposta longa, avisos novos dos outros também chegam.
3: O texto chega marcado como informação sobre os outros participantes, não
   como instrução.
4: Sem outros trabalhando, nada é injetado.

## Story 4.4 Alerta de conflito

As a participante,
I want ser avisado quando meu Claude vai mexer num arquivo que outro anunciou,
so that a gente não sobrescreva o trabalho um do outro.

### Acceptance Criteria

1: Antes de editar arquivo reservado por outro aviso ativo, o Claude é
   avisado de quem reservou e por quê (FR16).
2: A página da jam e o terminal mostram o conflito para as duas pessoas.
3: **[confirmado]** A edição só segue depois de confirmação no terminal de
   quem pediu.
4: A reserva acaba quando o Claude que anunciou termina.
