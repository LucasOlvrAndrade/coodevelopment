import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("sala da jam", () => {
  it("responde 404 fora do caminho das salas", async () => {
    const resposta = await exports.default.fetch("http://sala/qualquer-coisa");
    expect(resposta.status).toBe(404);
  });

  it("aceita o upgrade e fecha a conexão sem token com 4401", async () => {
    const resposta = await exports.default.fetch("http://sala/parties/jam/teste", {
      headers: { Upgrade: "websocket" },
    });
    expect(resposta.status).toBe(101);

    const ws = resposta.webSocket!;
    const fechou = new Promise<CloseEvent>((resolve) => ws.addEventListener("close", resolve));
    ws.accept();
    const evento = await fechou;
    expect(evento.code).toBe(4401);
  });
});
