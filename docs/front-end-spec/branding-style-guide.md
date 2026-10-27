# Branding & Style Guide

## Visual Identity

**Brand Guidelines:** não há marca prévia. Esta seção define a base
**[confirmado]**: ferramenta de desenvolvedor sóbria, fundo cor de papel no
claro, quase preto quente no escuro, e a cor dos participantes como único
elemento colorido forte. Checagem contra os 20 sinais de cara de IA: sem
degradê (1, 2, 20), sem emoji (3), fonte com personalidade (4, 19), sem
borda neon nem vidro (5, 6), escuro com contraste real (7), sem fileira de 3
ícones (8), sem brilho de fundo (9), poucos ícones (10), sem depoimento (11),
sem fade-in na rolagem nem luz no mouse (12, 13), hover rápido (14), escala
fixa (15), texto à esquerda (16), texto concreto (17, 18).

**Exceção, a faixa da página inicial (V1, 2026-10-27):** é o
`responsive-hero-banner` do 21st.dev igual ao prompt, a pedido do Lucas:
foto de fundo do componente (servida pelo próprio app), menu em pílula
translúcida com o botão branco, selo e botão principal translúcidos, título
em Instrument Serif, texto em Inter e entrada com deslize ao carregar, nas
cores do componente (branco e preto translúcidos, sem a primária). No lugar
dos logos de parceiros, os aplicativos do Grupo RAM passam em loop, em
branco. Abaixo da faixa, a seção "Como funciona" com os três passos, no
mesmo fundo. Esses sinais valem lá de propósito e só lá; as telas internas
continuam sóbrias como acima.

## Color Palette

Contrastes calculados (WCAG) sobre a superfície e sobre o fundo; todos os
textos passam de 4,5:1 e os controles de 3:1.

| Color Type | Hex Code | Usage |
|---|---|---|
| Primary | `#0F7433` nos dois temas, o verde do Grupo RAM (V2) | Ação principal e foco, só como preenchimento: texto branco sobre ela dá 5,9:1; como contorno de foco, 5,4:1 no claro e 3,1:1 no escuro |
| Secondary | Participante 1 `#AD4719` / `#F08A5B`; participante 2 `#24708F` / `#6BB8D6`; participante 3 `#7C600F` / `#D9B44A` | Marca de cada pessoa: faixa, avisos, arquivos dela |
| Accent | `--destaque`: `#0F7433` (claro) / `#4CC27A` (escuro) | Verde em texto (links, números, a segunda linha do título da página inicial): 5,4:1 sobre o fundo claro e 8,2:1 sobre o escuro. O destaque visual das telas internas continua vindo das cores dos participantes |
| Success | `#2D7A4B` / `#6CC891` | Conectado, commit feito |
| Warning | `#9A6410` / `#E3A74A` | Lembrete de trabalho não salvo, "sem aviso", dependências |
| Error | `#B3362A` / `#F07C6E` | Conflito, erros, ações destrutivas |
| Neutral | Claro: fundo `#F7F5F0`, superfície `#FFFFFF`, texto `#1C1B19`, secundário `#68645C`, divisória `#D6D1C6`, borda de controle `#8A8579`. Escuro: fundo `#141413`, superfície `#1E1D1B`, texto `#F2EFE8`, secundário `#A8A397`, divisória `#3A3833`, borda de controle `#7A766C` | Texto, bordas, fundos |

## Typography

### Font Families

- **Primary:** IBM Plex Sans **[confirmado]** (tem cara de ferramenta técnica
  sem ser a Inter de todo template; boa em português)
- **Secondary:** a mesma, em pesos diferentes (sem par de fontes)
- **Monospace:** IBM Plex Mono (comandos, prompts, caminhos de arquivo)
- **Página inicial (V1):** Inter no texto e Instrument Serif 400 nos
  títulos, como no componente original; só nas páginas públicas

### Type Scale

| Element | Size | Weight | Line Height |
|---|---|---|---|
| H1 | 28 px | 600 | 1.2 |
| H2 | 22 px | 600 | 1.25 |
| H3 | 18 px | 600 | 1.3 |
| Body | 15 px | 400 | 1.5 |
| Small | 13 px | 400 | 1.4 |

O texto do status do Claude usa 17 px, peso 500, para ser o maior texto
corrido da página da jam.

A faixa da página inicial tem título próprio, fora desta escala: 36 px no
celular, 48 px a partir de 640 px, 60 px a partir de 768 px e 72 px a partir
de 1024 px.

## Iconography

**Icon Library:** subconjunto pequeno do Lucide (cerca de 10 ícones),
traço 1,5 px, ajustados ao tamanho do texto **[confirmado]**.

**Usage Guidelines:** ícone só onde ajuda a reconhecer uma ação ou um tipo de
item do feed; nunca decorativo; sempre com texto ao lado ou `aria-label`.

## Spacing & Layout

**Grid System:** largura máxima de 1200 px no computador; página da jam em
duas colunas (cerca de 40/60) acima de 1024 px; uma coluna abaixo.

**Spacing Scale:** 4, 8, 12, 16, 24, 32, 48 px, sem valores fora da escala.
Raio de borda: 6 px em controles e faixas, 10 px em diálogos.
