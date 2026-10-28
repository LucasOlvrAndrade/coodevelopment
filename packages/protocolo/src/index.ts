export const VERSAO_PROTOCOLO = 1;

export { normalizarCaminho, normalizarFinalDeLinha } from "./normalizacao";
export type { Amizade, PedidoAmizade, Usuario } from "./modelos";
export { mensagemDaSala, mensagemPresenca, type MensagemDaSala, type MensagemPresenca } from "./mensagens";
export { DURACAO_TOKEN_SALA_S, assinarTokenSala, validarTokenSala, type QuemNaSala } from "./token-sala";
