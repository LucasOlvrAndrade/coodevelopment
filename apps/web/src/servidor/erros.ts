import "server-only";
import { unstable_rethrow } from "next/navigation";

const MENSAGENS: Record<string, string> = {
  inesperado: "Algo deu errado. Tente de novo.",
  reautenticar: "Sua conexão com o GitHub venceu. Entre de novo.",
};

export class ErroApp extends Error {
  constructor(
    public codigo: string,
    public status = 400,
    mensagem = MENSAGENS[codigo] ?? codigo,
  ) {
    super(mensagem);
  }
}

// Invólucro de toda rota: ErroApp vira ApiError; o resto é logado e vira "inesperado".
export function rota<C>(handler: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    const requestId = crypto.randomUUID();
    try {
      return await handler(req, ctx);
    } catch (e) {
      unstable_rethrow(e); // interrupções internas do Next (pré-render, notFound) não são erro nosso
      const erro = e instanceof ErroApp ? e : new ErroApp("inesperado", 500);
      if (!(e instanceof ErroApp)) {
        console.error(JSON.stringify({ nivel: "erro", requestId, erro: String(e) }));
      }
      return Response.json(
        {
          error: {
            code: erro.codigo,
            message: erro.message,
            timestamp: new Date().toISOString(),
            requestId,
          },
        },
        { status: erro.status },
      );
    }
  };
}
