# Backend Architecture

## Service Architecture

Serverless nas duas plataformas: funções da Vercel para o app e um Durable
Object por jam na Cloudflare.

### Function Organization

```text
apps/web/src/
├── app/api/
│   ├── auth/[...all]/route.ts         # Better Auth
│   ├── saude/route.ts
│   ├── jams/[id]/token-sala/route.ts
│   ├── jams/[id]/conector/route.ts
│   ├── conector/clone-token/route.ts
│   └── interno/sala/[id]/route.ts
└── servidor/
    ├── dominio/                       # regras puras: amizade, jam, fechamento
    ├── github.ts                      # Octokit com renovação de token
    └── sala.ts                        # cliente HTTP interno da sala

apps/sala/src/
├── index.ts                           # roteamento do Worker (routePartykitRequest)
├── jam.ts                             # class Jam extends Server
├── sincronizacao.ts                   # escrever, merge, histórico
├── fechamento.ts                      # travar, sobreposição, concluir
└── auth.ts                            # validação do JWT
```

### Function Template

```typescript
// apps/sala/src/jam.ts (trecho)
import { Server, type Connection, type ConnectionContext } from "partyserver";
import { mensagemDoCliente } from "@coodevelopment/protocolo";
import { validarToken } from "./auth";
import { aplicarEscrita } from "./sincronizacao";

export class Jam extends Server<Env> {
  static options = { hibernate: true };

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    const token = new URL(ctx.request.url).searchParams.get("token");
    const quem = token && (await validarToken(token, this.name, this.env.SEGREDO_SALA));
    if (!quem) return conn.close(4401, "token inválido");
    conn.setState(quem); // { usuarioId, via }
    conn.send(JSON.stringify(this.estadoCompleto()));
    this.anunciarPresenca();
  }

  async onMessage(conn: Connection<{ usuarioId: string; via: string }>, texto: string) {
    const m = mensagemDoCliente.safeParse(JSON.parse(texto));
    if (!m.success) return conn.send(JSON.stringify({ v: 1, tipo: "erro", motivo: "mensagem_invalida" }));
    if (m.data.tipo === "escrever") return aplicarEscrita(this, conn, m.data);
    // status, anunciar, divergencia...
  }
}
```

## Database Architecture

### Schema Design

Ver **Database Schema** acima (Neon e SQLite da sala).

### Data Access Layer

```typescript
// apps/web/src/servidor/dominio/jam.ts
import { and, eq, sql } from "drizzle-orm";
import { jam, participante } from "@/servidor/db/schema";

export async function chamarAmigo(tx: Tx, jamId: string, criadorId: string, amigoId: string) {
  const [j] = await tx.select().from(jam).where(eq(jam.id, jamId)).for("update");
  if (!j || j.criadorId !== criadorId) throw new ErroApp("jam_nao_encontrada");
  if (!(await saoAmigos(tx, criadorId, amigoId))) throw new ErroApp("so_amigos"); // FR6
  const [{ total }] = await tx.select({ total: sql<number>`count(*)` }).from(participante).where(eq(participante.jamId, jamId));
  if (total >= 3) throw new ErroApp("jam_cheia"); // D6
  await tx.insert(participante).values({ jamId, usuarioId: amigoId, papel: "convidado" });
}
```

As regras de domínio recebem a transação e não chamam o GitHub; a Server
Action chama o GitHub depois do commit no banco e marca `colaborador` como
`ok` ou `falhou` (Story 2.3, AC 4).

## Authentication and Authorization

### Auth Flow

```mermaid
sequenceDiagram
  participant U as Navegador
  participant W as App web (Better Auth)
  participant G as GitHub
  U->>W: Entrar com GitHub
  W->>G: authorize do GitHub App (instalar + autorizar)
  G-->>W: code
  W->>G: troca por token de usuário + refresh
  W->>W: cria ou atualiza user (githubId, login, nome, foto); tokens cifrados em account
  W-->>U: cookie de sessão (httpOnly, Secure, SameSite=Lax)
  U->>W: POST /api/jams/{id}/token-sala
  W->>W: confere participante
  W-->>U: JWT HS256 { sub, jam, via, exp: 10 min }
  U->>U: conecta na sala com o JWT
```

### Middleware/Guards

```typescript
// apps/web/src/servidor/auth.ts (trecho)
export async function exigirParticipante(jamId: string) {
  const eu = await exigirSessao(); // cookie do navegador ou Bearer do conector
  const p = await db.query.participante.findFirst({
    where: (t, { and, eq }) => and(eq(t.jamId, jamId), eq(t.usuarioId, eu.id)),
  });
  if (!p) throw new ErroApp("nao_participante", 403);
  return { eu, participante: p };
}
```
