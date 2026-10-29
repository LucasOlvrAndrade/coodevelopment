import "server-only";

// A sala responde? (Story 3.1: o diagnóstico do conector pergunta aqui, porque
// sem uma jam ele não sabe o endereço dela.) A raiz da sala é 404; erro do
// servidor (5xx) não conta como no ar. A resposta fica guardada 30 s: a rota é
// pública e não precisa chamar a sala a cada acesso (gate da 3.1, MNT-003).
// Sala fora do ar não derruba o app (Story 2.5, AC 4).
export type SituacaoDaSala = "ok" | "erro" | "desligada";
let guardada: { situacao: SituacaoDaSala; ate: number } | undefined;

export async function situacaoDaSala(): Promise<SituacaoDaSala> {
  const host = process.env.NEXT_PUBLIC_SALA_HOST;
  if (!host) return "desligada";
  if (guardada && guardada.ate > Date.now()) return guardada.situacao;
  const protocolo = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? "http" : "https";
  let situacao: SituacaoDaSala;
  try {
    const resposta = await fetch(`${protocolo}://${host}/`, { signal: AbortSignal.timeout(2000), cache: "no-store" });
    situacao = resposta.status < 500 ? "ok" : "erro";
  } catch {
    situacao = "erro";
  }
  guardada = { situacao, ate: Date.now() + 30_000 };
  return situacao;
}

// Só para os testes: esquece a resposta guardada.
export function esquecerSituacaoDaSala() {
  guardada = undefined;
}
