# Epic List

1. **Epic 1: Fundação, login e amigos:** app no ar com login pelo GitHub e
   rede de amigos (busca, pedidos, sugestões de mútuos).
2. **Epic 2: Jams no GitHub:** criar jam importando ou criando repositório,
   chamar amigos como colaboradores e ver a página da jam com quem está nela.
3. **Epic 3: Conector e sincronização ao vivo:** entrar na jam pelo terminal
   (com ajuda para o Node) e ter as mudanças de arquivo chegando ao vivo na
   pasta dos outros, guardadas no servidor.
4. **Epic 4: Claudes coordenados:** status ao vivo de cada Claude, aviso antes
   de mexer, contexto cruzado e alerta de conflito.
5. **Epic 5: Fechar e retomar:** fechar a jam com commit, reabrir com segurança
   e lembrar de trabalho não salvo.

Por que essa ordem: o Epic 3 vem antes do 4 porque o status e os avisos só
fazem sentido com os participantes trabalhando nos mesmos arquivos. Desde o
Epic 3 o estado fica no servidor (FR21), então nada se perde enquanto o
fechamento com commit (Epic 5) não existe. Dá para juntar 4 e 5 se ficarem
pequenos.
