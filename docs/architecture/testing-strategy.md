# Testing Strategy

## Testing Pyramid

```text
        E2E (Playwright): login simulado, nova jam, página ao vivo
       /                                                        \
  Integração: conector x sala real (wrangler dev) com duas pastas;
  hooks com a entrada JSON documentada; rotas x branch de teste do Neon
     /                                                            \
Unidade web: reducer da sala,     Unidade protocolo/sala/conector: merge,
componentes, regras de domínio    final de linha, caminhos, commit, eco
```

Mais o roteiro manual "jam a dois" com o Lucas e o pai ao fim de cada épico
(PRD).

- **Acessibilidade (WCAG AA, NFR10):** `@axe-core/playwright` em toda página
  nos testes E2E, nos dois temas e em 360 px; navegação só por teclado e
  leitor de tela (NVDA) no roteiro manual da página da jam.
- **Segurança:** testes de unidade do `gravarSeguro()` com caminhos maliciosos
  (`..`, absoluto, `.git/`, link simbólico, nome reservado do Windows como
  `CON`); testes da rota `token-sala` com quem não é participante; rodar a
  skill de revisão de segurança antes de abrir o app para amigos além do pai.
- **Desempenho:** a integração do conector mede NFR1 e NFR2 em 100 rodadas e
  falha acima do percentil 95.

## Test Organization

### Frontend Tests

```text
apps/web/tests/
├── unidade/        # reducer aplicarMensagem, regras de amizade e jam
├── componentes/    # FaixaParticipante, PassoConexao, DialogoFechar
└── rotas/          # token-sala, conector (branch de teste do Neon)
```

### Backend Tests

```text
apps/sala/tests/          # vitest-pool-workers: escrita, merge, conflito, fechamento
packages/protocolo/tests/ # caminhos, final de linha, mensagem de commit
packages/conector/tests/
├── unidade/              # eco, pendências, agrupamento
├── integracao/           # duas pastas temporárias + sala local (Story 3.3 AC 6)
└── hooks/                # cada hook com a entrada JSON da documentação
```

### E2E Tests

```text
apps/web/e2e/
├── login.spec.ts         # GitHub simulado (sessão injetada)
├── nova-jam.spec.ts      # GitHub falso por MSW
└── jam-ao-vivo.spec.ts   # página recebe status enviado por um conector de teste
```

## Test Examples

### Frontend Component Test

```typescript
import { render, screen } from "@testing-library/react";
import { FaixaParticipante } from "@/componentes/jam/FaixaParticipante";

it("mostra o status do Claude quando ele está trabalhando", () => {
  render(
    <FaixaParticipante
      participante={{ jamId: "j", usuarioId: "u", papel: "criador", colaborador: "ok", entrouEm: "", nome: "Lucas", avatarUrl: "" }}
      status="Claude Code de Lucas está trabalhando em: Corrigir login"
      conectado
    />,
  );
  expect(screen.getByText(/está trabalhando em: Corrigir login/)).toBeVisible();
});
```

### Backend API Test

```typescript
import { env, runInDurableObject } from "cloudflare:test";
import { aplicarEscrita } from "../src/sincronizacao";

it("faz merge quando duas escritas partem da mesma versão sem se cruzar", async () => {
  const stub = env.Jam.get(env.Jam.idFromName("teste"));
  await runInDurableObject(stub, async (sala) => {
    await escrever(sala, "a", "x.ts", 0, "1\n2\n3\n", "1\n2\n3\n");
    await escrever(sala, "a", "x.ts", 1, "um\n2\n3\n");
    const r = await escrever(sala, "b", "x.ts", 1, "1\n2\ntrês\n");
    expect(r.resultado).toBe("merge");
    expect(sala.lerArquivo("x.ts")).toBe("um\n2\ntrês\n");
  });
});
```

### E2E Test

```typescript
import { test, expect } from "@playwright/test";
import { conectorDeTeste } from "./apoio";

test("status do Claude aparece na página em menos de 1 s", async ({ page }) => {
  await page.goto("/jams/jam-teste");
  const conector = await conectorDeTeste("jam-teste", "pai");
  const inicio = Date.now();
  await conector.status("trabalhando");
  await conector.anunciar("Ajustar rota de backup", ["src/backup.ts"]);
  await expect(page.getByText("Claude Code de pai está trabalhando em: Ajustar rota de backup")).toBeVisible();
  expect(Date.now() - inicio).toBeLessThan(1000);
});
```
