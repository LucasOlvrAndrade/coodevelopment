# User Interface Design Goals

## Overall UX Vision

Uma sala de trabalho calma, que deixa a informação mais importante sempre à
vista: quem está aqui e o que cada Claude está fazendo agora. O app não
compete com o editor nem com o terminal; ele fica numa aba ou no celular ao
lado, e precisa ser legível de relance. O passo de conexão é o único momento
de "configuração" e deve ser guiado, um passo por vez.

## Key Interaction Paradigms

- **Presença em tempo real:** status e feed se atualizam sozinhos, sem
  recarregar; nada pisca nem pula de lugar quando chega coisa nova.
- **Leitura de relance:** cada participante é uma faixa com foto, nome e o
  status do Claude dele em uma frase.
- **Configuração guiada:** o passo de conexão (Node, comando de entrar) é um
  roteiro curto com botão de copiar.
- **Ações raras e explícitas:** fechar a jam pede confirmação e mostra o que vai
  ser commitado.

## Core Screens and Views

- Entrar (login com GitHub)
- Início: minhas jams
- Amigos: amigos, pedidos e sugestões de mútuos
- Nova jam: importar ou criar repositório, chamar amigos
- Página da jam: participantes com status ao vivo, feed, passo de conexão,
  lembrete de trabalho não salvo, fechar jam
- Confirmação de fechar jam
- Popup de pasta diferente ao reabrir (D17)

## Accessibility: WCAG AA

## Branding

Sem identidade definida. **[confirmado]** Visual sóbrio de ferramenta de
desenvolvedor, sem cara de template de IA (sem degradê roxo, sem
glassmorphism, sem emoji na interface). Definição na especificação de
front-end.

## Target Device and Platforms: Web Responsive

App web responsivo, computador e celular. O conector é uma ferramenta de
linha de comando para Windows.
