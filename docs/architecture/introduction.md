# Introduction

Este documento descreve a arquitetura completa do Coodevelopment: o app web,
a sala de tempo real, o conector que roda no PC de cada participante e o
plugin do Claude Code, e como eles conversam. É a fonte única para o
desenvolvimento feito com agentes.

O Coodevelopment não é um app web comum: metade do sistema roda no PC de cada
pessoa (D10). Por isso a arquitetura tem quatro partes que precisam ficar em
acordo, e um pacote de protocolo compartilhado garante isso.

## Starter Template or Existing Project

N/A, projeto greenfield. Nenhum starter de terceiros. O app web segue o preset
AIOX `nextjs-react` citado no PRD (Next.js, React, TypeScript, Tailwind), e a
sala segue o exemplo oficial do PartyServer. Nada vem de outro projeto do
Lucas (D11: o sistema não é desenhado para nenhum projeto específico).

## Change Log

| Date | Version | Description | Author |
|---|---|---|---|
| 2026-10-23 | 0.1 | Primeira versão, modo YOLO, a partir do PRD 0.2 | Aria (@architect), via Claude |
| 2026-10-23 | 0.2 | Validação do @po: sala no endereço `workers.dev`, porque o DNS de `lucas-andrade.dev` está na Vercel | Pax (@po), via Claude |
