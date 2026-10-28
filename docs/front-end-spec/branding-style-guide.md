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
mesmo fundo.

**O app inteiro no visual da página inicial (V3, 2026-10-28):** o Lucas pediu
que as telas internas tivessem o mesmo design da página inicial, e a
identidade sóbria acima deixou de valer. Agora, em todas as telas: sempre
escuro (o tema claro saiu), a foto da página inicial no alto, a 60% e sumindo
no fundo antes do conteúdo, marca e títulos em Instrument Serif, texto em
Inter, navegação numa pílula translúcida (no celular, uma pílula flutuante
embaixo), ações em pílula (a principal branca, a secundária translúcida) e
listas, formulários e avisos em painéis translúcidos. Vidro e brilho de fundo
(sinais 5, 6 e 9) passam a valer de propósito. Continuam: sem degradê em
texto, sem emoji, sem fade-in na rolagem, texto à esquerda e a cor dos
participantes como a única cor forte. As classes ficam em
`apps/web/src/componentes/ui/estilo.ts`.

## Color Palette

Uma paleta só, sempre escura (V3). Contrastes calculados (WCAG) sobre o
fundo; todos os textos passam de 4,5:1 e os controles de 3:1.

| Color Type | Hex Code | Usage |
|---|---|---|
| Primary | `#FAFAFA`, o branco do texto | Ação principal em pílula branca com texto `#09090B` (19:1) e contorno de foco. O verde da V2 saiu |
| Secondary | Participante 1 `#F08A5B`; participante 2 `#6BB8D6`; participante 3 `#D9B44A` | Marca de cada pessoa: anel da foto, faixa, avisos, arquivos dela. Iniciais do avatar em `#09090B` sobre a cor (8:1) |
| Accent | O branco do texto em 5% (painéis e campos), 10% (botão secundário, item ativo, divisória) e 15% (contorno das pílulas) | O vidro da página inicial |
| Success | `#6CC891` (9,8:1) | Conectado, commit feito, "No repositório" |
| Warning | `#E3A74A` (9,4:1) | Lembrete de trabalho não salvo, "sem aviso", dependências |
| Error | `#F07C6E` (7,4:1) | Conflito, erros, ações destrutivas |
| Neutral | Fundo `#09090B`, superfície `#131316` (menus e diálogos), texto `#FAFAFA`, secundário `#A1A1AA` (7,8:1), divisória branco a 10%, borda de controle branco a 40% (3,7:1) | Texto, bordas, fundos |

## Typography

### Font Families

- **Primary:** Inter (V3, como na página inicial; antes IBM Plex Sans)
- **Títulos:** Instrument Serif 400, na marca e nos títulos de página, de
  seção e de diálogo
- **Monospace:** IBM Plex Mono (comandos, prompts, caminhos de arquivo,
  usuário do GitHub, nome de repositório)

### Type Scale

| Element | Size | Weight | Line Height |
|---|---|---|---|
| H1 | 40 px, Instrument Serif | 400 | 1.1 |
| H2 | 28 px, Instrument Serif | 400 | 1.2 |
| H3 | 18 px, Inter | 500 | 1.3 |
| Body | 15 px | 400 | 1.5 |
| Small | 13 px | 400 | 1.4 |
| Botão | 14 px | 500 | 1.43 |

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
Raio de borda (V3): pílula nos botões, na navegação e nos selos; 12 px nos
campos; 16 px nos painéis, menus e diálogos.
