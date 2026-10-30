export const VERSAO_PROTOCOLO = 1;

export { ALFABETO_ID_JAM, idDeJamValido } from "./id-jam";
export { normalizarCaminho, normalizarFinalDeLinha } from "./normalizacao";
export type { Amizade, PedidoAmizade, Usuario } from "./modelos";
export { mensagemDaSala, mensagemDoConector, mensagemPresenca, type MensagemDaSala, type MensagemDoConector, type MensagemPresenca } from "./mensagens";
export {
  PREFIXO_TEMPORARIO,
  TAMANHO_MAXIMO,
  caminhoSincronizavel,
  hashDoConteudo,
  juntar,
  mensagemAceito,
  mensagemArquivo,
  mensagemEscrever,
  mensagemManifesto,
  mensagemRecusado,
  tamanhoDoConteudo,
  type MensagemAceito,
  type MensagemArquivo,
  type MensagemEscrever,
  type MensagemManifesto,
  type MensagemRecusado,
} from "./sincronizacao";
export { DURACAO_TOKEN_SALA_S, assinarTokenSala, validarTokenSala, type QuemNaSala } from "./token-sala";
