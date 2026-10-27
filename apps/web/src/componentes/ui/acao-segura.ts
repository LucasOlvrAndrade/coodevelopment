import type { Resultado } from "@/servidor/erros";

// Server Action que lança (sem rede, deploy novo no meio do caminho) vira um
// erro com mensagem, em vez de escapar do useTransition e derrubar a tela
// (gate da 2.1, A11Y-001).
export async function semQuebrar<T>(acao: () => Promise<Resultado<T>>): Promise<Resultado<T>> {
  try {
    return await acao();
  } catch {
    return {
      ok: false,
      erro: { codigo: "sem_conexao", mensagem: "Não deu para falar com o servidor. Confira a conexão e tente de novo." },
    };
  }
}
