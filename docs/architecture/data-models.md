# Data Models

Dois lugares guardam dados, cada um com um papel:

- **Neon (app web):** quem é quem e o que existe: usuários, amizades, jams,
  participantes, fechamentos.
- **SQLite da sala (uma por jam):** o que está acontecendo: arquivos em
  andamento, histórico, avisos, feed, divergências.

Os tipos abaixo moram em `packages/protocolo/src/modelos.ts`.

## Usuario

**Purpose:** pessoa com conta, criada no primeiro login pelo GitHub (FR1).

**Key Attributes:**
- id: string - id interno (Better Auth)
- githubId: number - id numérico do GitHub, estável mesmo se o login mudar
- login: string - usuário do GitHub, usado na busca (FR2)
- nome: string - nome do perfil do GitHub, usado no status (D19)
- avatarUrl: string - foto do GitHub

### TypeScript Interface

```typescript
export interface Usuario {
  id: string;
  githubId: number;
  login: string;
  nome: string; // cai para login quando o perfil não tem nome
  avatarUrl: string;
  criadoEm: string; // ISO 8601
}
```

### Relationships

- Tem uma `account` do Better Auth com os tokens do GitHub (cifrados).
- Participa de várias jams; tem várias amizades e pedidos.

## Amizade e PedidoAmizade

**Purpose:** rede de amigos; só amigos podem ser chamados para uma jam (FR2,
FR6). Pedido cruzado vira aceite direto (front-end spec, confirmado).

**Key Attributes:**
- usuarioA, usuarioB: string - par guardado em ordem (`usuarioA < usuarioB`)
  para não duplicar
- de, para: string - quem pediu e quem recebeu
- status: "pendente" | "recusado"

### TypeScript Interface

```typescript
export interface Amizade {
  usuarioA: string;
  usuarioB: string;
  criadaEm: string;
}

export interface PedidoAmizade {
  id: string;
  de: string;
  para: string;
  status: "pendente" | "recusado";
  criadoEm: string;
}
```

### Relationships

- Aceitar um pedido apaga o pedido e cria a amizade, na mesma transação.

## Jam

**Purpose:** sala de trabalho ligada a um repositório do criador (D4).

**Key Attributes:**
- id: string - identificador curto e legível, usado no comando `npx`
- repoOwner, repoNome: string - repositório no GitHub
- criadorId: string - dono do repositório e do token que faz o commit
- estado: "aberta" | "fechando" | "fechada"
- baseSha: string - commit de partida da sessão atual

### TypeScript Interface

```typescript
export type EstadoJam = "aberta" | "fechando" | "fechada";

export interface Jam {
  id: string; // ex.: "k7m2-rbq9" (sem caracteres ambíguos)
  nome: string;
  repoOwner: string;
  repoNome: string;
  branch: string; // branch padrão do repositório no momento da criação
  criadorId: string;
  estado: EstadoJam;
  baseSha: string;
  criadaEm: string;
  ultimoCommitEm: string | null;
}
```

### Relationships

- Tem de 1 a 3 participantes (D6), um deles o criador.
- Tem vários fechamentos (um por commit feito).

## Participante

**Purpose:** ligação de um usuário a uma jam, com a situação no GitHub.

### TypeScript Interface

```typescript
export interface Participante {
  jamId: string;
  usuarioId: string;
  papel: "criador" | "convidado";
  colaborador: "ok" | "pendente" | "falhou"; // convite do GitHub (Story 2.3)
  entrouEm: string;
}
```

### Relationships

- Pertence a uma jam e a um usuário. A jam continua se o criador sair (D16):
  sair apaga o participante, mas o token do criador continua sendo usado no
  commit enquanto ele não revogar o app.

## Fechamento

**Purpose:** registro de cada commit feito ao fechar a jam (FR22, NFR3).

### TypeScript Interface

```typescript
export interface Fechamento {
  id: string;
  jamId: string;
  fechadoPor: string;
  commitSha: string | null; // null enquanto o commit não terminou
  arquivos: number;
  status: "em_andamento" | "ok" | "falhou";
  erro: string | null;
  criadoEm: string;
}
```

## Modelos da sala (SQLite do Durable Object)

**Purpose:** estado ao vivo da jam, guardado junto da conexão.

### TypeScript Interface

```typescript
// Um arquivo que mudou desde o baseSha. Arquivo sem registro = igual ao base.
export interface ArquivoJam {
  caminho: string; // relativo à raiz, sempre com "/"
  versao: number; // sobe a cada escrita aceita; 0 = conteúdo do baseSha
  hash: string; // sha256 do conteúdo normalizado (final de linha LF)
  apagado: boolean;
  binario: boolean;
  tamanho: number;
  autorId: string;
  avisoId: string | null; // aviso ativo do autor quando a escrita chegou
  atualizadoEm: string;
}

export interface Aviso {
  id: string;
  autorId: string;
  resumo: string; // vira o status (FR13)
  arquivos: string[]; // reservas (FR16)
  ativo: boolean; // termina no Stop do Claude que anunciou
  criadoEm: string;
}

export type StatusClaude =
  | { tipo: "parado" }
  | { tipo: "trabalhando"; avisoId: string | null; desde: string };

export type EventoFeed =
  | { tipo: "aviso"; avisoId: string; autorId: string; resumo: string; arquivos: string[] }
  | { tipo: "arquivos"; autorId: string; caminhos: string[]; resumo: string; semAviso: boolean }
  | { tipo: "dependencias"; autorId: string; caminho: string }
  | { tipo: "conflito"; autorId: string; caminho: string; resolvido: "merge" | "guardado" }
  | { tipo: "entrou" | "saiu"; usuarioId: string; via: "conector" | "pagina" }
  | { tipo: "fechada"; usuarioId: string; commitSha: string };
```

### Relationships

- `ArquivoJam` mora na tabela `arquivo` da sala (Story 3.3). O conteúdo de
  cada versão aceita fica em `versao` (as últimas 20 por arquivo, base dos
  merges; a versão 0 é o conteúdo do `baseSha`, guardado na primeira
  escrita), e o que não entrou fica em `historico`: a escrita que perdeu num
  conflito (`motivo: conflito`) e o binário sobrescrito pela última escrita
  (`motivo: sobrescrito`), até 500 entradas por jam. Cada linha cabe nos 2 MB do SQLite do Durable
  Object porque o arquivo tem no máximo 1 MB (A14). A limpeza depois do
  commit fica para o fechamento (Story 5.1).
- `Aviso` reserva arquivos enquanto está ativo.
