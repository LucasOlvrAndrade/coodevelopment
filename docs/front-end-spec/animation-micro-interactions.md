# Animation & Micro-interactions

## Motion Principles

Movimento só para dizer que algo mudou de estado, nunca para enfeitar. Nada
entra com fade-in ao rolar. Tudo curto (150 ms ou menos em respostas ao
usuário) e desligado ou reduzido a troca simples com
`prefers-reduced-motion`.

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
