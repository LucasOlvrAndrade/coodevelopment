# Animation & Micro-interactions

## Motion Principles

Movimento só para dizer que algo mudou de estado, nunca para enfeitar. Nada
entra com fade-in ao rolar. Tudo curto (150 ms ou menos em respostas ao
usuário) e desligado ou reduzido a troca simples com
`prefers-reduced-motion`.

Exceção (V1): a faixa da página inicial entra uma vez, ao carregar, com
opacidade e deslize de 20 px (700 ms, ease-out, em cascata de 100 ms). Não
anima ao rolar, e com movimento reduzido não anima. A faixa dos aplicativos
do Grupo RAM anda sem parar (cerca de 45 px/s), para com o mouse em cima ou
pelo botão de pausa (WCAG 2.2.2) e, com movimento reduzido, fica parada em
grade.

## Key Animations

- **Claude trabalhando:** três pontos alternando opacidade ao lado do status
  (Duration: 1200 ms por ciclo, Easing: ease-in-out); com movimento reduzido,
  pontos parados.
- **Status mudou:** texto novo substitui o antigo com troca de opacidade
  (Duration: 120 ms, Easing: ease-out).
- **Item novo no feed:** fundo levemente marcado que some (Duration: 2000 ms,
  Easing: linear); sem deslizar.
- **Hover e pressionar:** mudança de cor (Duration: 120 ms, Easing: ease-out).
- **Diálogo:** aparece com opacidade e escala de 98% para 100% (Duration: 140
  ms, Easing: ease-out).
- **Copiado:** botão troca para "Copiado" (Duration: imediato; volta após 2 s).
