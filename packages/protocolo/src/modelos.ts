// Modelos compartilhados entre o app, a sala e o conector (data-models.md).

export interface Usuario {
  id: string;
  githubId: number; // estável mesmo se o login mudar
  login: string; // usado na busca (FR2)
  nome: string; // cai para login quando o perfil não tem nome (D19)
  avatarUrl: string;
  criadoEm: string; // ISO 8601
}

// Par em ordem (usuarioA < usuarioB, na collation do banco) para não duplicar.
export interface Amizade {
  usuarioA: string;
  usuarioB: string;
  criadaEm: string;
}

// Aceito vira Amizade e some; recusado volta a pendente se pedido de novo (A10).
export interface PedidoAmizade {
  id: string;
  de: string;
  para: string;
  status: "pendente" | "recusado";
  criadoEm: string;
}
