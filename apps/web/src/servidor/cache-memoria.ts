import "server-only";

// Cache em memória da instância, com validade. Para resultados caros que podem
// atrasar uns minutos (os mútuos do GitHub, gate da 1.4, PERF-001). Cada
// instância da Vercel tem o seu: nada que precise ser exato vai aqui. Guarda a
// promessa, então pedidos ao mesmo tempo esperam o mesmo cálculo; erro não
// fica guardado.
const MAX_ENTRADAS = 500;

export function criarCache<T>(validadeMs: number) {
  const entradas = new Map<string, { expira: number; valor: Promise<T> }>();

  return {
    obter(chave: string, calcular: () => Promise<T>): Promise<T> {
      const agora = Date.now();
      const guardada = entradas.get(chave);
      if (guardada && guardada.expira > agora) return guardada.valor;

      const valor = calcular();
      entradas.delete(chave);
      entradas.set(chave, { expira: agora + validadeMs, valor });
      valor.catch(() => {
        if (entradas.get(chave)?.valor === valor) entradas.delete(chave);
      });
      // A mais antiga sai primeiro (o Map guarda a ordem de entrada).
      if (entradas.size > MAX_ENTRADAS) {
        const maisAntiga = entradas.keys().next().value;
        if (maisAntiga !== undefined) entradas.delete(maisAntiga);
      }
      return valor;
    },
  };
}
