# Checklist Results

`accessibility-wcag-checklist.md` aplicado à especificação (não há código
ainda; itens de implementação ficam para o QA de cada story):

- **Perceivable:** contraste conferido por cálculo nos dois temas (texto
  4,5:1 ou mais, controles 3:1 ou mais); nenhum indicador só por cor (status
  e feed usam texto e ícone); paridade do modo escuro definida. OK na
  especificação.
- **Operable:** teclado, ordem do Tab, foco visível, diálogos sem armadilha e
  atalho para o feed definidos. OK na especificação.
- **Understandable:** rótulos, erros em texto, estados de carregando e
  regiões `aria-live` definidos. OK na especificação.
- **Robust:** HTML semântico e ARIA correta ficam para a implementação.
  Pendente (verificar com axe e NVDA).

**Resultado:** especificação compatível com WCAG AA; validação real depende
das telas.
