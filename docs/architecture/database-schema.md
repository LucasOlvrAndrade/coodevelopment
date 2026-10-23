# Database Schema

Neon (Drizzle gera as migrations a partir do schema em TypeScript; o SQL
abaixo é a referência). As tabelas do Better Auth (`user`, `session`,
`account`, `verification`, `device_code`) vêm do gerador dele e ganham as
colunas `github_id` e `login` em `user`.

```sql
create table pedido_amizade (
  id text primary key,
  de text not null references "user"(id) on delete cascade,
  para text not null references "user"(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','recusado')),
  criado_em timestamptz not null default now(),
  check (de <> para),
  unique (de, para)
);

create table amizade (
  usuario_a text not null references "user"(id) on delete cascade,
  usuario_b text not null references "user"(id) on delete cascade,
  criada_em timestamptz not null default now(),
  primary key (usuario_a, usuario_b),
  check (usuario_a < usuario_b)
);

create table jam (
  id text primary key,
  nome text not null,
  repo_owner text not null,
  repo_nome text not null,
  branch text not null,
  criador_id text not null references "user"(id),
  estado text not null default 'aberta' check (estado in ('aberta','fechando','fechada')),
  base_sha text not null,
  primeira_mudanca_em timestamptz, -- lembrete de 24 h (FR24); a sala atualiza
  ultimo_commit_em timestamptz,
  criada_em timestamptz not null default now()
);
create index jam_repo on jam (repo_owner, repo_nome);

create table participante (
  jam_id text not null references jam(id) on delete cascade,
  usuario_id text not null references "user"(id) on delete cascade,
  papel text not null check (papel in ('criador','convidado')),
  colaborador text not null default 'pendente' check (colaborador in ('ok','pendente','falhou')),
  entrou_em timestamptz not null default now(),
  primary key (jam_id, usuario_id)
);
create index participante_usuario on participante (usuario_id);

create table fechamento (
  id text primary key,
  jam_id text not null references jam(id) on delete cascade,
  fechado_por text not null references "user"(id),
  commit_sha text,
  branch text,
  arquivos integer not null default 0,
  status text not null check (status in ('em_andamento','ok','falhou')),
  erro text,
  criado_em timestamptz not null default now()
);
```

O limite de 3 participantes (D6) é verificado na Server Action de chamar
amigo, dentro de uma transação com `select ... for update` na jam.

SQLite da sala (criado pela própria sala na primeira conexão):

```sql
create table arquivo (
  caminho text primary key,
  versao integer not null,
  hash text not null,
  apagado integer not null default 0,
  binario integer not null default 0,
  tamanho integer not null,
  autor_id text not null,
  aviso_id text,
  atualizado_em text not null
);

create table versao_arquivo (
  caminho text not null,
  versao integer not null, -- 0 = conteúdo do baseSha
  conteudo blob, -- null quando apagado
  autor_id text not null,
  guardada_em_conflito integer not null default 0,
  criado_em text not null,
  primary key (caminho, versao, guardada_em_conflito)
);

create table aviso (
  id text primary key,
  autor_id text not null,
  resumo text not null,
  arquivos text not null, -- JSON
  ativo integer not null,
  criado_em text not null
);

create table evento (
  id integer primary key autoincrement,
  tipo text not null,
  dados text not null, -- JSON validado pelo protocolo
  criado_em text not null
);

create table meta (chave text primary key, valor text not null);
-- base_sha, estado, primeira_mudanca_em
```

Retenção: `versao_arquivo` é apagada em cada commit (o conteúdo vira
histórico do git). O feed guarda os eventos desde o último commit mais os
7 dias anteriores.

Backup e recuperação: o Neon tem restauração para um ponto no tempo (janela
do plano) e o SQLite dos Durable Objects tem recuperação para um ponto no
tempo dos últimos 30 dias (`getBookmarkForTime` / `onNextSessionRestoreBookmark`)
**[verificar na Story 3.3]**. O trabalho só fica fora do git enquanto a jam
está aberta, e o lembrete de 24 h (FR24) limita essa janela.
