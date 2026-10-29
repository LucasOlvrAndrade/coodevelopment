// Id curto e legível da jam, usado no comando do conector: "k7m2-rbq9", sem
// caracteres que se confundem (0 e o, 1, l e i). O app gera; o app e o
// conector conferem o formato antes de usar o id em caminho ou consulta.
export const ALFABETO_ID_JAM = "23456789abcdefghjkmnpqrstuvwxyz";

const FORMATO_ID = new RegExp(`^[${ALFABETO_ID_JAM}]{4}-[${ALFABETO_ID_JAM}]{4}$`);

export function idDeJamValido(id: string): boolean {
  return FORMATO_ID.test(id);
}
