# Accessibility Requirements

## Compliance Target

**Standard:** WCAG 2.2 AA.

## Key Requirements

**Visual:**
- Color contrast ratios: texto 4,5:1 ou mais, texto grande e controles 3:1 ou
  mais, nos dois temas (valores conferidos na paleta).
- Focus indicators: anel de 2 px na cor primária com 2 px de afastamento,
  sempre visível ao navegar por teclado.
- Text sizing: legível com zoom de 200% sem rolagem horizontal; tamanhos em
  `rem`.

**Interaction:**
- Keyboard navigation: tudo acessível por teclado; ordem do Tab segue a
  leitura; diálogos prendem o foco e fecham com Esc; atalho para pular para o
  feed.
- Screen reader support: o status de cada participante é anunciado por
  `aria-live="polite"` só quando muda de estado (não a cada item do feed);
  o feed é uma lista com rótulo; ícones com `aria-label`.
- Touch targets: 44 x 44 px no mínimo.

**Content:**
- Alternative text: foto do participante com o nome dele; ícones
  decorativos com `alt=""`.
- Heading structure: um H1 por página (repositório na jam), H2 para
  "Pessoas" e "Feed".
- Form labels: todo campo com rótulo visível; erros abaixo do campo, em texto.

## Testing Strategy

`accessibility-wcag-checklist.md` do AIOX em cada épico com tela; axe
automatizado nos testes de ponta a ponta; navegação só por teclado e leitura
com NVDA (Windows, que é o que os usuários usam) na página da jam.
