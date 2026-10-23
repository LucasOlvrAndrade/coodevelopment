# Performance Considerations

## Performance Goals

- **Page Load:** página da jam utilizável em até 2,5 s numa conexão comum
  (LCP).
- **Interaction Response:** resposta visual a clique em até 100 ms; status
  recebido do tempo real na tela em até 100 ms após chegar (o total de 1 s é
  do NFR1).
- **Animation FPS:** 60 fps; só opacidade e transformação são animadas.

## Design Strategies

- O feed carrega os últimos 50 itens e busca mais ao rolar.
- Atualizações em tempo real agrupadas por quadro, para uma rajada de
  arquivos não travar a página.
- Fontes com `font-display: swap` e só os pesos usados (400, 500, 600).
- Sem imagens decorativas; as únicas imagens são as fotos do GitHub, em
  tamanho fixo.
