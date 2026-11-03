import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O partysocket de mentira, como no teste da presença.
const { sockets, SocketDeTeste } = vi.hoisted(() => {
  const sockets: InstanceType<typeof SocketDeTeste>[] = [];
  class SocketDeTeste extends EventTarget {
    constructor(public opcoes: unknown) {
      super();
      sockets.push(this);
    }
    close() {}
  }
  return { sockets, SocketDeTeste };
});
vi.mock("partysocket", () => ({ default: SocketDeTeste }));

const { PresencaDaJam, PAROU_POR_MS } = await import("@/componentes/jams/PresencaDaJam");
const { StatusDoClaude } = await import("@/componentes/jams/StatusDoClaude");

function daSala(mensagem: object) {
  act(() => {
    sockets.at(-1)!.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ v: 1, ...mensagem }) }));
  });
}

async function pagina() {
  render(
    <PresencaDaJam jamId="k7m2-rbq9">
      <StatusDoClaude usuarioId="lucas" nome="Lucas Andrade" eu="pai" />
      <StatusDoClaude usuarioId="pai" nome="Kelson" eu="pai" />
    </PresencaDaJam>,
  );
  await waitFor(() => expect(sockets).toHaveLength(1));
}

beforeEach(() => {
  sockets.length = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ token: "t", salaUrl: "wss://sala.teste/parties/jam/k7m2-rbq9" }))),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("status do Claude na página da jam (Story 4.1)", () => {
  it("mostra quem está trabalhando e some quando para (AC 2 e 3)", async () => {
    await pagina();
    daSala({ tipo: "claudes", trabalhando: [{ usuarioId: "lucas", desde: "2026-11-03T12:00:00.000Z" }, { usuarioId: "pai", desde: "2026-11-03T12:00:00.000Z" }] });
    expect(screen.getByText("Claude Code de Lucas Andrade está trabalhando")).toBeInTheDocument();
    expect(screen.getByText("Seu Claude Code está trabalhando")).toBeInTheDocument();
    daSala({ tipo: "claudes", trabalhando: [] });
    expect(screen.queryByText(/está trabalhando/)).toBeNull();
  });

  it("parada por erro aparece por alguns segundos e some; voltar a trabalhar tira o aviso (AC 3)", async () => {
    await pagina();
    vi.useFakeTimers();
    daSala({ tipo: "claudes", trabalhando: [] });
    daSala({ tipo: "parou", usuarioId: "lucas", motivo: "rate_limit" });
    expect(screen.getByText("Claude Code de Lucas Andrade parou: limite de uso atingido")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PAROU_POR_MS + 10));
    expect(screen.queryByText(/parou/)).toBeNull();

    daSala({ tipo: "parou", usuarioId: "lucas", motivo: "overloaded" });
    daSala({ tipo: "claudes", trabalhando: [{ usuarioId: "lucas", desde: "2026-11-03T12:01:00.000Z" }] });
    expect(screen.queryByText(/parou/)).toBeNull();
    expect(screen.getByText("Claude Code de Lucas Andrade está trabalhando")).toBeInTheDocument();
  });

  it("um parou novo recomeça os 8 s, mesmo com o mesmo motivo (gate da 4.1, UX-002)", async () => {
    await pagina();
    vi.useFakeTimers();
    daSala({ tipo: "parou", usuarioId: "lucas", motivo: "rate_limit" });
    act(() => vi.advanceTimersByTime(PAROU_POR_MS - 1000));
    daSala({ tipo: "parou", usuarioId: "lucas", motivo: "rate_limit" });
    act(() => vi.advanceTimersByTime(2000));
    expect(screen.getByText(/parou: limite de uso atingido/)).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(PAROU_POR_MS));
    expect(screen.queryByText(/parou/)).toBeNull();
  });

  it("caiu a conexão com a sala: o status some", async () => {
    await pagina();
    daSala({ tipo: "claudes", trabalhando: [{ usuarioId: "lucas", desde: "2026-11-03T12:00:00.000Z" }] });
    act(() => {
      sockets.at(-1)!.dispatchEvent(new CloseEvent("close", { code: 1006 }));
    });
    expect(screen.queryByText(/está trabalhando/)).toBeNull();
  });
});
