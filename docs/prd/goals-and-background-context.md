# Goals and Background Context

## Goals

- Dois ou três desenvolvedores trabalham no mesmo projeto ao mesmo tempo, cada
  um com o próprio Claude Code, sem trabalhar em turnos.
- Cada participante sabe, a qualquer momento e sem perguntar, se o Claude dos
  outros está trabalhando e em quê.
- Cada Claude sabe o que os outros Claudes estão fazendo e é avisado antes de
  mexer num arquivo que outro anunciou.
- As mudanças de cada um chegam ao vivo na pasta dos outros, e o projeto
  rodando em cada PC mostra o trabalho de todos.
- Nenhum trabalho se perde: ao fechar a jam, tudo vira commit e push, sem
  merge manual.
- Funciona com projetos de qualquer stack, sem o Coodevelopment conhecer o
  projeto.

## Background Context

Quem programa com o Claude Code trabalha sozinho por construção: cada sessão é
de uma pessoa, o status dela só aparece no terminal de quem a abriu, e o
trabalho de um só chega ao outro depois do push. O Lucas e o pai, os dois
desenvolvedores com Claude Code no Windows, querem começar a construir juntos
e hoje só conseguiriam fazer isso em turnos.

O Coodevelopment não substitui o Claude Code, o editor nem o jeito de rodar o
projeto. Ele acrescenta uma camada de coordenação: uma **jam** (sala ligada a
um repositório do GitHub) e um **conector local** que liga o Claude Code e a
pasta do projeto à jam, por hooks e por um servidor MCP. A arquitetura passou
por sandbox na nuvem e por navegador antes de chegar aqui (D1, D8, D10); a
razão de ficar no PC de cada um é servir para qualquer stack (D11).

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-10-22 | 0.1 | Primeira versão, modo YOLO, a partir do brief 1.1 | Morgan (@pm), via Claude |
| 2026-10-23 | 0.2 | Lucas confirmou todas as suposições | Morgan (@pm), via Claude |
| 2026-10-23 | 0.3 | Ajustes da validação do @po: decisões da arquitetura, partes novas na 1.1, GitHub App na 1.2, sala na 2.4, Git no prompt da 3.2, aprovação do MCP na 4.1, ações do Lucas | Pax (@po), via Claude |
