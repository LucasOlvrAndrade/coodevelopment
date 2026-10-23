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

## Color Palette

Contrastes calculados (WCAG) sobre a superfície e sobre o fundo; todos os
textos passam de 4,5:1 e os controles de 3:1.

| Color Type | Hex Code | Usage |
|---|---|---|
| Primary | `#1F6B57` (claro) / `#5FC1A3` (escuro) | Ação principal, links, foco |
| Secondary | Participante 1 `#AD4719` / `#F08A5B`; participante 2 `#24708F` / `#6BB8D6`; participante 3 `#7C600F` / `#D9B44A` | Marca de cada pessoa: faixa, avisos, arquivos dela |
| Accent | `#1F6B57` / `#5FC1A3` | O mesmo da primária; o destaque visual vem das cores dos participantes |
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
