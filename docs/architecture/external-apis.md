# External APIs

## GitHub API

- **Purpose:** login, repositórios, colaboradores, mútuos, commit.
- **Documentation:** https://docs.github.com/en/rest
- **Base URL(s):** https://api.github.com
- **Authentication:** GitHub App com token de usuário (user access token),
  que expira em 8 h e é renovado com refresh token pelo app. Token de
  instalação só para o clone do conector.
- **Rate Limits:** por usuário, com escala por instalação; folgado para o uso
  previsto.

**Por que GitHub App e não OAuth App (NFR9):** o escopo `repo` do OAuth App dá
escrita em todos os repositórios privados do usuário, inclusive de
organizações. O GitHub App pede só o necessário, e o token expira sozinho.
Custo: o usuário instala o app na conta no primeiro login. Isso é feito no
mesmo passo do login ("Request user authorization during installation"), com
a opção "All repositories", para que um repositório criado pela jam já
esteja coberto. **[verificar na Story 1.2]**: se a instalação com "selected
repositories" inclui sozinha o repositório recém-criado; se não, a tela de
nova jam pede "All repositories".

Permissões do GitHub App:

| Permissão | Nível | Para quê |
|---|---|---|
| Administration | write | Criar repositório (Story 2.2) e adicionar colaborador (2.3) |
| Contents | write | Commit pela Git Data API (5.1) |
| Workflows | write | Só se a jam mexer em `.github/workflows` |
| Metadata | read | Listar repositórios (2.1) |
| Followers (conta) | read | Mútuos (1.4) |

**Key Endpoints Used:**
- `GET /user`, `GET /user/following`, `GET /user/followers` (paginados) - perfil e mútuos
- `GET /user/repos` - escolher repositório
- `POST /user/repos` - criar repositório com `auto_init: true`
- `PUT /repos/{owner}/{repo}/collaborators/{username}` - chamar amigo
- `GET /user/repository_invitations` + `PATCH /user/repository_invitations/{id}` -
  aceitar o convite com o token do amigo **[verificar na Story 2.3 que o
  token de usuário do GitHub App pode aceitar convite; se não puder, a página
  da jam mostra o link do convite para o amigo aceitar com um clique]**
- `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`, `POST .../git/blobs`,
  `POST .../git/trees` (com `base_tree`), `POST .../git/commits`,
  `PATCH .../git/refs/heads/{branch}` - fechamento

**Integration Notes:** Octokit com renovação automática do token antes de
cada chamada. Os tokens ficam na tabela `account` do Better Auth, cifrados
(AES-256-GCM com chave em variável de ambiente) **[verificar na Story 1.2 se
o Better Auth cifra tokens nativamente; se não, cifrar no hook de banco]**.

## Cloudflare (deploy)

- **Purpose:** hospedar a sala. Sem API em tempo de execução; só `wrangler
  deploy` no CI.
