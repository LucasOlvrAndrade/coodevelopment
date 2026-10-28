# Frontend Architecture

## Component Architecture

### Component Organization

```text
apps/web/src/
├── app/
│   ├── (publico)/page.tsx            # entrada com botão de login
│   ├── (app)/layout.tsx              # exige sessão
│   ├── (app)/inicio/page.tsx         # minhas jams
│   ├── (app)/amigos/page.tsx
│   ├── (app)/jams/nova/page.tsx
│   ├── (app)/jams/[id]/page.tsx      # Server Component: dados da jam
│   ├── (app)/dispositivo/page.tsx    # confirmar código do conector
│   └── api/...
├── componentes/
│   ├── ui/                           # Botao, Dialogo, BlocoCopiar... (Radix + tokens)
│   └── jam/                          # FaixaParticipante, ItemFeed, PassoConexao...
├── sala/
│   ├── conexao.ts                    # partysocket + token, reconexão
│   └── use-sala.ts                   # hook com useSyncExternalStore
├── servidor/                         # só roda no servidor ("server-only")
│   ├── auth.ts, github.ts, db/, acoes/
└── estilos/tokens.css                # tokens da front-end spec, paleta escura (V3)
```

### Component Template

```typescript
import type { Participante } from "@coodevelopment/protocolo";

type Props = {
  participante: Participante & { nome: string; avatarUrl: string };
  status: string | null; // "Claude Code de Lucas está trabalhando em: ..."
  conectado: boolean;
};

export function FaixaParticipante({ participante, status, conectado }: Props) {
  return (
    <li className="flex items-start gap-3 py-3">
      <img src={participante.avatarUrl} alt="" width={32} height={32} className="rounded-full" />
      <div className="min-w-0">
        <p className="font-medium">{participante.nome}</p>
        <p aria-live="polite" className="text-[var(--texto-suave)]">
          {status ?? (conectado ? "Conectado" : "Não conectado")}
        </p>
      </div>
    </li>
  );
}
```

## State Management Architecture

### State Structure

```typescript
// Estado ao vivo da página da jam, montado a partir das mensagens da sala.
export interface EstadoSala {
  conexao: "conectando" | "aberta" | "caiu";
  participantes: Record<string, { pagina: boolean; conector: boolean; soLocal: boolean }>;
  status: Record<string, StatusClaude>;
  avisosAtivos: Aviso[];
  feed: EventoFeed[]; // mais novo primeiro, no máximo 200 na memória
  arquivosSemCommit: number;
  primeiraMudancaEm: string | null;
  jam: "aberta" | "fechando" | "fechada";
  divergencia: string[] | null; // popup da D17 para mim
}
```

### State Management Patterns

- Uma conexão por aba, criada no `use-sala.ts`; o estado é um reducer puro
  (`aplicarMensagem(estado, mensagem)`) testado com Vitest.
- Dados que não são ao vivo (nomes, fotos, repositório) vêm do Server
  Component e não passam pela sala.
- Nada de estado global fora da página da jam.

## Routing Architecture

### Route Organization

```text
/                      pública: o que é + Entrar com GitHub
/inicio                minhas jams (FR7)
/amigos                amigos, pedidos, sugestões de mútuos
/jams/nova             importar ou criar repositório, chamar amigos
/jams/[id]             página da jam
/dispositivo           confirmar o código do conector
```

### Protected Route Pattern

```typescript
// apps/web/src/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/servidor/auth";

export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const sessao = await auth.api.getSession({ headers: await headers() });
  if (!sessao) redirect("/");
  return <>{children}</>;
}
```

A página da jam ainda confere se o usuário é participante (`notFound()` se
não for), e a rota `token-sala` confere de novo.

## Frontend Services Layer

### API Client Setup

```typescript
// apps/web/src/sala/conexao.ts
import PartySocket from "partysocket";
import { mensagemDaSala, type MensagemDaSala } from "@coodevelopment/protocolo";

export async function conectarSala(jamId: string, aoReceber: (m: MensagemDaSala) => void) {
  const pedirToken = async () => {
    const r = await fetch(`/api/jams/${jamId}/token-sala`, { method: "POST", body: JSON.stringify({ via: "pagina" }) });
    if (!r.ok) throw new Error(`token-sala ${r.status}`);
    return (await r.json()) as { token: string; salaUrl: string };
  };
  const { salaUrl } = await pedirToken();
  const ws = new PartySocket({
    host: new URL(salaUrl).host,
    party: "jam",
    room: jamId,
    query: async () => ({ token: (await pedirToken()).token }), // token novo a cada reconexão
  });
  ws.addEventListener("message", (e) => {
    const m = mensagemDaSala.safeParse(JSON.parse(e.data));
    if (m.success) aoReceber(m.data);
  });
  return ws;
}
```

### Service Example

```typescript
// apps/web/src/servidor/acoes/amizade.ts
"use server";
import { exigirSessao } from "@/servidor/auth";
import { db } from "@/servidor/db";
import { pedirAmizade as regra } from "@/servidor/dominio/amizade";

export async function pedirAmizade(paraLogin: string) {
  const eu = await exigirSessao();
  return db.transaction((tx) => regra(tx, eu.id, paraLogin)); // pedido cruzado vira aceite
}
```
