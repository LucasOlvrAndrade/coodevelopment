# Wireframes & Mockups

**Primary Design Files:** sem ferramenta de design por enquanto
**[confirmado]**; os leiautes abaixo são a referência, e a primeira versão da
página da jam serve de protótipo.

## Key Screen Layouts

### Página da jam (computador)

**Purpose:** mostrar de relance quem está na jam e o que cada Claude está
fazendo, com o histórico ao lado.

**Key Elements:**
- Cabeçalho: `dono/repositório`, quantos estão conectados, lembrete de
  trabalho não salvo (quando houver) e botão "Fechar jam".
- Coluna esquerda (cerca de 40%): uma faixa por participante, com foto, nome,
  marca de cor, estado do conector e, em destaque, o status do Claude; abaixo
  do status, os arquivos anunciados como etiquetas.
- Coluna direita (cerca de 60%): feed em ordem cronológica, mais recente em
  cima, com filtro "Tudo | Avisos | Arquivos".
- Passo de conexão no lugar da faixa do próprio usuário enquanto ele não
  conectou.

```
┌──────────────────────────────────────────────────────────────────┐
│ Coodevelopment   Jams  Amigos                            (foto) │
├──────────────────────────────────────────────────────────────────┤
│ lucas/loja-da-familia     2 de 2 conectados        [Fechar jam] │
├─────────────────────────┬────────────────────────────────────────┤
│ ▌(foto) Lucas  conectado │ Tudo | Avisos | Arquivos               │
│ ▌Claude Code de Lucas    │ ─────────────────────────────────────  │
│ ▌está trabalhando em:    │ ▌Lucas anunciou · agora                │
│ ▌"tela de login com      │ ▌tela de login com validação           │
│ ▌ validação"   há 1 min  │ ▌app/login/page.tsx  lib/auth.ts       │
│ ▌[app/login/page.tsx]    │                                        │
│                          │ ▌pai alterou lib/estoque.ts · 2 min    │
│ ▌(foto) Pai   conectado  │ ▌+12 −3                                │
│ ▌Claude Code parado      │                                        │
└─────────────────────────┴────────────────────────────────────────┘
```

**Interaction Notes:** status e feed atualizam sozinhos; item novo no feed
entra no topo sem empurrar a leitura se a pessoa rolou para baixo (aparece
"3 novos" para voltar ao topo). Etiqueta de arquivo copia o caminho ao clicar.

**Design File Reference:** este documento.

### Página da jam (celular)

**Purpose:** acompanhar a jam com o celular ao lado do PC.

**Key Elements:**
- Cabeçalho compacto com o repositório e menu (Fechar jam fica no menu).
- Seletor fixo "Pessoas | Feed".
- Faixas de participantes compactas: foto, nome e a frase do status em até 3
  linhas.

**Interaction Notes:** abre em "Pessoas", porque o status é o que importa de
relance.

**Design File Reference:** este documento.

### Início (minhas jams)

**Purpose:** voltar a uma jam ou criar outra.

**Key Elements:**
- Lista de jams abertas primeiro, depois as fechadas; cada item com
  repositório, fotos dos participantes e, se houver Claude trabalhando agora,
  a frase do status de quem está.
- Botão "Criar jam".
- Estado vazio com "Criar jam" e "Adicionar amigos".

**Interaction Notes:** lista simples, sem cards em grade de três.

**Design File Reference:** este documento.

### Amigos

**Purpose:** gerenciar amigos e pedidos.

**Key Elements:**
- Pedidos recebidos no topo, com aceitar e recusar.
- "Adicionar": sugestões de mútuos do GitHub que usam o app, e campo de busca.
- Lista de amigos com opção de desfazer amizade (com confirmação).

**Interaction Notes:** enviar pedido muda o botão para "Pedido enviado" na
hora.

**Design File Reference:** este documento.

### Nova jam

**Purpose:** criar a jam em uma tela só.

**Key Elements:**
- Escolha "Importar repositório | Criar repositório".
- Lista com busca dos repositórios (importar) ou campos de nome e
  visibilidade (criar).
- Seleção de amigos com contador "0 de 2".

**Interaction Notes:** o botão "Criar jam" só habilita com repositório
escolhido; amigos são opcionais.

**Design File Reference:** este documento.
