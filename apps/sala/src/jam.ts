import { Server, type Connection } from "partyserver";

// Uma sala por jam. Esqueleto da Story 1.1: ainda não há token, então toda
// conexão é recusada. A validação do token entra na Story 2.4.
export class Jam extends Server<Env> {
  static options = { hibernate: true };

  onConnect(conexao: Connection) {
    conexao.close(4401, "token ausente");
  }
}
