# Project Brief: Coodevelopment

Template `project-brief-tmpl.yaml` v2.0, modo interativo. Base:
`docs/decisoes.md` (D2 a D8). Em construção, seção por seção.

## Executive Summary

**Coodevelopment** é um app web em que até três desenvolvedores trabalham
juntos no mesmo projeto, cada um com a própria sessão do Claude, dentro de uma
**jam**: uma sala ligada a um repositório do GitHub, com o projeto rodando
direto no navegador de cada participante.

**Problema:** quem já programa com o Claude Code, como o Lucas e o pai dele,
trabalha em paralelo às cegas. Cada um roda o próprio Claude, que não sabe o
que o outro Claude está fazendo; um só descobre as mudanças do outro depois do
push, muitas vezes com conflito, e para ver o resultado do outro precisa puxar
o código e rodar na própria máquina.

**Público:** desenvolvedores que já usam o Claude Code e querem construir algo
juntos. De início, o Lucas e o pai dele; depois, amigos e pequenos grupos.

**Proposta de valor:** contexto em tempo real. Antes de mexer em qualquer
coisa, o Claude de cada pessoa anuncia o que vai mudar, e esse aviso chega na
hora à tela dos outros e ao contexto dos outros Claudes. Ao lado, um preview
único do projeto se atualiza com as mudanças de todos. Ao fechar a jam, o
trabalho vai sozinho para o GitHub, sem conflito para resolver depois.
