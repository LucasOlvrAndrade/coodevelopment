// Modelos compartilhados entre o app, a sala e o conector (data-models.md).

export interface Usuario {
  id: string;
  githubId: number; // estável mesmo se o login mudar
  login: string; // usado na busca (FR2)
  nome: string; // cai para login quando o perfil não tem nome (D19)
  avatarUrl: string;
  criadoEm: string; // ISO 8601
}
