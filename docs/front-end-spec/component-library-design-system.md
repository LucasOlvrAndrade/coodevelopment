# Component Library / Design System

**Design System Approach:** sistema próprio e pequeno, em Tailwind com tokens
CSS (uma paleta escura, V3), sobre primitivos acessíveis sem estilo (Radix) para
diálogo, menu e seletor **[confirmado]**. Nada de biblioteca pronta com
aparência padrão. Ícones: poucos, só onde ajudam a reconhecer (copiar,
fechar, aviso, arquivo, conectado), traço de 1,5 px, sempre com texto ou
`aria-label`.

## Core Components

### Faixa do participante

**Purpose:** mostrar uma pessoa e o Claude dela.

**Variants:** completa (computador), compacta (celular, Início).

**States:** desconectado; conectado e Claude parado; trabalhando (sem resumo
ainda); trabalhando com resumo; conflito; parou por erro; só local (D17).

**Usage Guidelines:** a marca de cor fica na borda esquerda (4 px); o texto do
status usa o tamanho de destaque; o tempo ("há 1 min") em texto secundário.
Indicador de "trabalhando": três pontos com animação discreta, desligada com
movimento reduzido.

### Item do feed

**Purpose:** registrar o que aconteceu.

**Variants:** aviso, arquivo alterado, sem aviso, dependências mudaram,
conflito, sistema (entrou, saiu, jam fechada).

**States:** novo (fundo levemente marcado por 2 s), normal, agrupado
("pai alterou 4 arquivos").

**Usage Guidelines:** autor e hora sempre visíveis; variantes "sem aviso",
"dependências" e "conflito" têm ícone e texto, nunca só cor.

### Passo de conexão

**Purpose:** levar a pessoa de "sem conector" a "conectado".

**Variants:** passo do Node, passo do comando, aguardando conexão, ajuda
(após 2 min).

**States:** atual, concluído, com erro.

**Usage Guidelines:** um passo por vez; cada um com uma frase de explicação e
um bloco de copiar.

### Bloco de copiar

**Purpose:** prompt ou comando para colar no terminal ou no Claude Code.

**Variants:** comando (uma linha), prompt (várias linhas).

**States:** normal, copiado ("Copiado" por 2 s).

**Usage Guidelines:** fonte mono; botão "Copiar" com texto, não só ícone.

### Etiqueta de arquivo

**Purpose:** mostrar um caminho de arquivo.

**Variants:** anunciado, alterado, em conflito.

**States:** normal, foco, copiado.

**Usage Guidelines:** mono, encurta o meio do caminho em telas pequenas
(`app/…/page.tsx`), caminho completo no `title`.

### Diálogo de confirmação

**Purpose:** fechar jam, desfazer amizade, popup de pasta diferente.

**Variants:** simples, com lista (arquivos do commit, arquivos diferentes).

**States:** aberto, processando, erro.

**Usage Guidelines:** a ação principal diz o que faz ("Fechar e commitar"),
nunca "OK".

### Botão

**Purpose:** ações.

**Variants:** principal, secundário, perigo, só texto.

**States:** normal, hover, foco, pressionado, desabilitado, carregando.

**Usage Guidelines:** uma ação principal por tela; hover em até 150 ms.

### Avatar

**Purpose:** foto do GitHub.

**Variants:** 24, 32 e 40 px.

**States:** com foto, sem foto (iniciais sobre a cor do participante).

**Usage Guidelines:** sempre acompanhado do nome em listas.
