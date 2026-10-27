import "server-only";
import { unstable_rethrow } from "next/navigation";

const MENSAGENS: Record<string, string> = {
  inesperado: "Algo deu errado. Tente de novo.",
  reautenticar: "Sua conexão com o GitHub venceu. Entre de novo.",
  sem_sessao: "Sua sessão terminou. Entre de novo.",
  entrada_invalida: "Não deu para entender o pedido. Recarregue a página e tente de novo.",
  // Amigos (Story 1.3)
  login_invalido: "Isso não parece um usuário do GitHub: use letras, números e hífen.",
  amizade_consigo: "Você não pode pedir amizade a si mesmo.",
  usuario_nao_encontrado: "Essa pessoa não usa mais o Coodevelopment.",
  pedido_nao_encontrado: "Esse pedido não está mais pendente.",
  nao_sao_amigos: "Vocês já não são amigos.",
  // Jams (Story 2.1)
  repositorio_nao_encontrado: "Não achei esse repositório no seu GitHub. Recarregue a lista e tente de novo.",
  repositorio_de_outra_conta: "Só dá para criar uma jam com um repositório da sua conta.",
  repositorio_vazio: "Esse repositório ainda não tem nenhum commit. Faça um commit nele ou crie um repositório novo pela jam.",
  jam_ja_existe: "Já existe uma jam aberta para esse repositório. Ela está no seu Início.",
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

// Resultado das Server Actions (error-handling-strategy.md): não lançam para a
// página; o erro chega com a mensagem pronta para mostrar.
export type Resultado<T> = { ok: true; dados: T } | { ok: false; erro: { codigo: string; mensagem: string } };

export async function executar<T>(f: () => Promise<T>): Promise<Resultado<T>> {
  try {
    return { ok: true, dados: await f() };
  } catch (e) {
    unstable_rethrow(e);
    if (!(e instanceof ErroApp)) console.error(JSON.stringify({ nivel: "erro", erro: String(e) }));
    const erro = e instanceof ErroApp ? e : new ErroApp("inesperado", 500);
    return { ok: false, erro: { codigo: erro.codigo, mensagem: erro.message } };
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
