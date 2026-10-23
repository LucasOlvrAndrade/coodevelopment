# Information Architecture (IA)

## Site Map / Screen Inventory

```mermaid
graph TD
    A[Página inicial pública] --> B[Entrar com GitHub]
    B --> C[Início: minhas jams]
    C --> D[Nova jam]
    D --> D1[Importar repositório]
    D --> D2[Criar repositório]
    D --> D3[Chamar amigos]
    C --> E[Página da jam]
    E --> E1[Passo de conexão]
    E --> E2[Participantes e status]
    E --> E3[Feed]
    E --> E4[Fechar jam: confirmação]
    E --> E5[Popup de pasta diferente]
    E --> E6[Participantes: chamar mais amigos]
    A --> H[Confirmar código do conector]
    C --> F[Amigos]
    F --> F1[Amigos]
    F --> F2[Pedidos recebidos e enviados]
    F --> F3[Adicionar: sugestões de mútuos e busca]
    C --> G[Menu da conta: sair]
```

## Navigation Structure

**Primary Navigation:** barra superior fixa com o nome do app (leva ao
Início), "Jams", "Amigos" (com contador de pedidos recebidos) e a foto do
usuário (menu com "Sair"). No celular, "Jams" e "Amigos" viram uma barra
inferior com dois itens.

**Secondary Navigation:** dentro da página da jam não há abas no
computador: participantes à esquerda, feed à direita. No celular, as duas
áreas ficam empilhadas e um seletor "Pessoas | Feed" fixo no topo da jam leva
a cada uma.

**Breadcrumb Strategy:** sem breadcrumb; a hierarquia tem dois níveis. Na
página da jam, o título mostra `dono/repositório` e um link "Jams" volta ao
Início.
