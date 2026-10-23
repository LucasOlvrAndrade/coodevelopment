# Core Workflows

## Login do conector por dispositivo

```mermaid
sequenceDiagram
  participant K as Conector
  participant W as App web
  participant U as Navegador do usuário
  K->>W: POST /api/auth/device/code
  W-->>K: user_code "WDJB-MJHT" + verification_uri
  K->>K: mostra o código e abre o navegador
  U->>W: /dispositivo (logado), confirma o código
  loop a cada 5 s
    K->>W: POST /api/auth/device/token
  end
  W-->>K: sessão do conector
  K->>K: guarda a sessão em %LOCALAPPDATA% (cofre do Windows via DPAPI)
  K->>W: POST /api/jams/{id}/token-sala
  W-->>K: JWT de 10 min + salaUrl
  K->>K: renova o JWT antes de expirar
```

## Escrita simultânea no mesmo arquivo

```mermaid
sequenceDiagram
  participant A as Conector A
  participant S as Sala
  participant B as Conector B
  Note over A,B: os dois partem de src/x.ts v4
  A->>S: escrever v-base 4
  S->>S: aceita, vira v5
  S-->>B: arquivo v5
  B->>S: escrever v-base 4 (saiu antes de receber v5)
  S->>S: merge de três vias (base v4, nosso v5, deles)
  alt sem sobreposição
    S->>S: aceita o resultado, vira v6
    S-->>A: arquivo v6 (origem merge)
    S-->>B: arquivo v6 (origem merge)
  else trechos se cruzam
    S->>S: guarda a versão de B no histórico
    S-->>B: recusado conflito_guardado + arquivo v5
    S-->>A: evento conflito
    Note over B: o hook injeta no Claude de B que a versão dele foi guardada e como recuperar
  end
```

Regras do conector na sincronização (Story 3.3):

- **Sem eco:** guarda o hash de tudo que gravou vindo da sala; evento do vigia
  com o mesmo hash é ignorado.
- **Mudança local pendente:** se chega da sala um arquivo que tem mudança
  local ainda não enviada, o conector não grava; envia a dele com a versão
  base antiga, e a sala faz o merge.
- **Agrupamento:** espera 150 ms sem eventos no mesmo arquivo antes de
  enviar; salvamento em rajada vira uma escrita.
- **Final de linha:** o hash e o merge usam o conteúdo com LF. Ao gravar, o
  conector usa o final de linha que o arquivo já tinha; arquivo novo segue o
  `core.autocrlf` do git local (NFR7).
- **O que nunca vai:** o que o `git check-ignore` ignora, `.git/`, `.env*`
  (exceto `.env.example`), caminho fora da pasta, link simbólico para fora,
  arquivo acima de 5 MB (vira evento no feed). A lista fixa vale mesmo que o
  `.gitignore` do projeto esqueça.
- **Binário:** detectado por byte nulo nos primeiros 8 KB; sincronizado
  inteiro, sem merge (a última escrita vence e a anterior fica no histórico).

## Fechar a jam (Story 5.1)

```mermaid
sequenceDiagram
  participant P as Página
  participant W as App web
  participant S as Sala
  participant G as GitHub
  P->>W: fechar (Server Action)
  W->>S: travar (escritas novas são recusadas)
  S-->>P: fechando
  W->>S: sobreposicao
  S-->>W: arquivos mudados + avisos da sessão
  W->>G: ref da branch
  alt ref == baseSha
    W->>G: blobs, tree com base_tree, commit, atualizar ref
    G-->>W: commitSha
    W->>S: concluir-fechamento(commitSha)
    S->>S: baseSha = commitSha, sobreposição e histórico limpos
    S-->>P: fechada
  else alguém fez push fora da jam
    W->>G: commit na branch nova jam/AAAA-MM-DD-hhmm
    W->>S: concluir-fechamento(commitSha, branch)
    S-->>P: fechada, com aviso da branch e link para abrir PR
  end
  Note over W,S: qualquer falha: destravar, estado intacto, erro na página (NFR3)
```

A mensagem do commit é montada em `packages/protocolo` (D18): primeira linha
com o resumo do aviso mais citado, corpo com a lista de avisos da sessão por
autor, e um `Co-authored-by: Nome <id+login@users.noreply.github.com>` por
participante. O commit é feito com o token do criador. A mensagem pode ser
editada na confirmação (front-end spec, confirmado).

## Reabrir com a pasta diferente (D17, Story 5.2)

Ao conectar numa jam reaberta, o conector compara a pasta com o estado da jam
(`git diff --name-only <baseSha>` mais os arquivos não rastreados e não
ignorados, contra o manifesto da sala). Se houver diferença, manda
`divergencia` com a lista; a sala pede a escolha à página daquela pessoa.

- **Atualizar:** o conector grava a versão da jam. Antes, copia cada arquivo
  que vai sobrescrever para
  `%LOCALAPPDATA%\coodevelopment\copias\<jam>\<data>\`, para nada local se
  perder sem volta. Arquivos ignorados nunca são tocados.
- **Seguir com a antiga:** o conector entra em modo só local (`soLocal`):
  recebe status e feed, mas não envia nem grava arquivos até a pessoa
  escolher atualizar.
