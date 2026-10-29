import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// O partysocket de mentira: guarda as opções e deixa o teste disparar os eventos da sala.
const { sockets, SocketDeTeste } = vi.hoisted(() => {
  const sockets: InstanceType<typeof SocketDeTeste>[] = [];
  class SocketDeTeste extends EventTarget {
    fechado = false;
    constructor(public opcoes: { host: string; protocol: string; party: string; room: string; query: () => Promise<{ token: string }> }) {
      super();
      sockets.push(this);
    }
    close() {
      this.fechado = true;
    }
  }
  return { sockets, SocketDeTeste };
});
vi.mock("partysocket", () => ({ default: SocketDeTeste }));

const { MarcaConectado, MarcaOnline, PresencaDaJam } = await import("@/componentes/jams/PresencaDaJam");

const fetch = vi.fn();

function tokenOk(token = "token-1") {
  return new Response(JSON.stringify({ token, salaUrl: "wss://sala.teste/parties/jam/k7m2-rbq9", expiraEm: "2026-10-28T12:10:00Z" }));
}

function presenca(...online: string[]) {
  presencaCom(online, []);
}

function presencaCom(online: string[], conectados: string[]) {
  act(() => {
    sockets.at(-1)!.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ v: 1, tipo: "presenca", online, conectados }) }));
  });
}

function pagina() {
  return render(
    <PresencaDaJam jamId="k7m2-rbq9">
      <p>Lucas</p>
      <MarcaOnline usuarioId="lucas" />
      <p>Pai</p>
      <MarcaOnline usuarioId="pai" />
      <MarcaConectado usuarioId="pai" />
    </PresencaDaJam>,
  );
}

beforeEach(() => {
  sockets.length = 0;
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("presença ao vivo na página da jam (Story 2.5)", () => {
  it("conecta na sala da jam com o token e marca quem está online (AC 1)", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    expect(fetch).toHaveBeenCalledWith("/api/jams/k7m2-rbq9/token-sala", { method: "POST", cache: "no-store" });
    expect(sockets[0]!.opcoes).toMatchObject({ host: "sala.teste", protocol: "wss", party: "jam", room: "k7m2-rbq9" });
    presenca("pai");
    expect(screen.getAllByText("online agora")).toHaveLength(1);
  });

  it("marca \"conectado\" em quem está com o conector ligado, sem confundir com a página aberta (Story 3.1, AC 3)", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    presencaCom([], ["pai"]);
    expect(screen.getByText("conectado")).toBeInTheDocument();
    expect(screen.queryByText("online agora")).toBeNull();
    presencaCom(["pai"], []);
    expect(screen.queryByText("conectado")).toBeNull();
    expect(screen.getByText("online agora")).toBeInTheDocument();
  });

  it("a presença se atualiza sozinha, sem recarregar (AC 2)", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    presenca("lucas", "pai");
    expect(screen.getAllByText("online agora")).toHaveLength(2);
    presenca("lucas");
    expect(screen.getAllByText("online agora")).toHaveLength(1);
  });

  it("a primeira conexão usa o primeiro token; cada reconexão pede outro", async () => {
    fetch.mockResolvedValueOnce(tokenOk("token-1")).mockResolvedValueOnce(tokenOk("token-2"));
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    expect(await sockets[0]!.opcoes.query()).toEqual({ token: "token-1" });
    expect(await sockets[0]!.opcoes.query()).toEqual({ token: "token-2" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("na reconexão, sessão vencida ou fora da jam fecham a conexão; rede fora deixa o partysocket tentar de novo (gate da 2.5, REL-001)", async () => {
    for (const [status, fecha] of [[503, false], [401, true], [403, true]] as const) {
      sockets.length = 0;
      fetch.mockResolvedValueOnce(tokenOk()).mockResolvedValueOnce(new Response("", { status }));
      const { unmount } = pagina();
      await waitFor(() => expect(sockets).toHaveLength(1));
      await sockets[0]!.opcoes.query();
      await expect(sockets[0]!.opcoes.query()).rejects.toThrow(`token-sala ${status}`);
      expect(sockets[0]!.fechado).toBe(fecha);
      unmount();
    }
  });

  it("sem a sala (503), não conecta e a página segue igual (AC 4)", async () => {
    fetch.mockResolvedValueOnce(new Response("{}", { status: 503 }));
    pagina();
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(sockets).toHaveLength(0);
    expect(screen.getByText("Pai")).toBeInTheDocument();
    expect(screen.queryByText("online agora")).toBeNull();
  });

  it("caiu a conexão: some a presença; token recusado pela sala para de tentar", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    presenca("pai");
    act(() => {
      sockets[0]!.dispatchEvent(new CloseEvent("close", { code: 1006 }));
    });
    expect(screen.queryByText("online agora")).toBeNull();
    expect(sockets[0]!.fechado).toBe(false);
    act(() => {
      sockets[0]!.dispatchEvent(new CloseEvent("close", { code: 4401 }));
    });
    expect(sockets[0]!.fechado).toBe(true);
  });

  it("mensagem que não é do protocolo é ignorada", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    act(() => {
      sockets[0]!.dispatchEvent(new MessageEvent("message", { data: "não é json" }));
      sockets[0]!.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ v: 9, tipo: "presenca", online: ["pai"], conectados: [] }) }));
    });
    expect(screen.queryByText("online agora")).toBeNull();
  });

  it("sair da página fecha a conexão", async () => {
    fetch.mockResolvedValueOnce(tokenOk());
    const { unmount } = pagina();
    await waitFor(() => expect(sockets).toHaveLength(1));
    unmount();
    expect(sockets[0]!.fechado).toBe(true);
  });
});
