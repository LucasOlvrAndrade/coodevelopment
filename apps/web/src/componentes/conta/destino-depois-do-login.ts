// Para onde voltar depois do login (gate da 3.1, REL-003): quem abre o link do
// conector sem estar logado entra pelo GitHub e volta para /dispositivo com o
// código. Só esse destino passa, com o código no formato dele: nada de
// redirecionar para outro site ou outra página pelo parâmetro.
const DESTINO = /^\/dispositivo(\?user_code=[A-Za-z0-9-]{1,20})?$/;

export function destinoDepoisDoLogin(para: unknown): string | null {
  return typeof para === "string" && DESTINO.test(para) ? para : null;
}
