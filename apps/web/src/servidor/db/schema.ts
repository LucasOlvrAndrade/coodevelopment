import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgTable, primaryKey, smallint, text, timestamp, unique, uniqueIndex } from "drizzle-orm/pg-core";

// Tabelas do Better Auth 1.7 (campos de get-tables do @better-auth/core),
// com nomes de coluna em snake_case. As chaves em camelCase são as que o
// adaptador procura; não renomear.

const criadoEm = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const atualizadoEm = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  // Campos do Coodevelopment: id numérico do GitHub (estável, único) e usuário
  // (busca, FR2). O login não é único: no GitHub, um nome trocado fica livre
  // para outra pessoa antes de o dono antigo voltar e atualizar o dele. A busca
  // é exata e sem diferença de maiúscula (A10), daí o índice em lower(login).
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
}, (t) => [index("user_login_lower").on(sql`lower(${t.login})`)]);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("session_user_id").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // Tokens do GitHub cifrados pelo Better Auth (encryptOAuthTokens, NFR8).
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  // Uma conta por provedor e por usuário: o login do GitHub não se repete, e
  // tokenDoUsuario acha sempre a mesma linha (gate da 1.2, MNT-001).
  (t) => [
    uniqueIndex("account_provider_account").on(t.providerId, t.accountId),
    uniqueIndex("account_user_provider").on(t.userId, t.providerId),
  ],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: criadoEm(),
    updatedAt: atualizadoEm(),
  },
  (t) => [index("verification_identifier").on(t.identifier)],
);

// Login do conector por dispositivo (Story 3.1): campos do plugin
// device-authorization do Better Auth 1.7.
export const deviceCode = pgTable(
  "device_code",
  {
    id: text("id").primaryKey(),
    deviceCode: text("device_code").notNull().unique(),
    userCode: text("user_code").notNull().unique(),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text("status").notNull(),
    lastPolledAt: timestamp("last_polled_at", { withTimezone: true }),
    pollingInterval: integer("polling_interval"),
    clientId: text("client_id"),
    scope: text("scope"),
  },
);

// Amigos (Story 1.3, database-schema.md). Pedido aceito vira amizade e some;
// recusado fica guardado e volta a pendente se a pessoa pedir de novo (A10).
export const pedidoAmizade = pgTable(
  "pedido_amizade",
  {
    id: text("id").primaryKey(),
    de: text("de")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    para: text("para")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pendente", "recusado"] }).notNull().default("pendente"),
    criadoEm: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    unique("pedido_amizade_de_para").on(t.de, t.para),
    index("pedido_amizade_para").on(t.para),
    check("pedido_amizade_status", sql`${t.status} in ('pendente', 'recusado')`),
    check("pedido_amizade_outra_pessoa", sql`${t.de} <> ${t.para}`),
  ],
);

// O par fica em ordem (usuario_a < usuario_b) para a mesma amizade não entrar duas vezes.
export const amizade = pgTable(
  "amizade",
  {
    usuarioA: text("usuario_a")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    usuarioB: text("usuario_b")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "amizade_par", columns: [t.usuarioA, t.usuarioB] }),
    index("amizade_usuario_b").on(t.usuarioB),
    check("amizade_par_em_ordem", sql`${t.usuarioA} < ${t.usuarioB}`),
  ],
);

// Jams (Story 2.1, database-schema.md). Uma jam não fechada por repositório
// (A11), pelo id numérico do repositório no GitHub: dono e nome mudam quando
// alguém renomeia, o id não (gate da 2.1, REL-001).
export const jam = pgTable(
  "jam",
  {
    id: text("id").primaryKey(),
    nome: text("nome").notNull(),
    repoId: bigint("repo_id", { mode: "number" }).notNull(),
    repoOwner: text("repo_owner").notNull(),
    repoNome: text("repo_nome").notNull(),
    branch: text("branch").notNull(),
    criadorId: text("criador_id")
      .notNull()
      .references(() => user.id),
    estado: text("estado", { enum: ["aberta", "fechando", "fechada"] }).notNull().default("aberta"),
    baseSha: text("base_sha").notNull(),
    // Lembrete de trabalho sem commit há 24 h (FR24); a sala atualiza.
    primeiraMudancaEm: timestamp("primeira_mudanca_em", { withTimezone: true }),
    ultimoCommitEm: timestamp("ultimo_commit_em", { withTimezone: true }),
    criadaEm: timestamp("criada_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("jam_repo").on(t.repoOwner, t.repoNome),
    uniqueIndex("jam_repo_aberta")
      .on(t.repoId)
      .where(sql`${t.estado} <> 'fechada'`),
    check("jam_estado", sql`${t.estado} in ('aberta', 'fechando', 'fechada')`),
  ],
);

export const participante = pgTable(
  "participante",
  {
    jamId: text("jam_id")
      .notNull()
      .references(() => jam.id, { onDelete: "cascade" }),
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    papel: text("papel", { enum: ["criador", "convidado"] }).notNull(),
    // Convite de colaborador no GitHub (Story 2.3); o criador é o dono, já "ok".
    colaborador: text("colaborador", { enum: ["ok", "pendente", "falhou"] }).notNull().default("pendente"),
    // Vaga de 1 a 3, única por jam (A12): o limite de 3 pessoas (D6) vale pelo
    // banco mesmo com dois chamados ao mesmo tempo, sem transação. Criador = 1.
    vaga: smallint("vaga").notNull(),
    entrouEm: timestamp("entrou_em", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ name: "participante_jam_usuario", columns: [t.jamId, t.usuarioId] }),
    index("participante_usuario").on(t.usuarioId),
    uniqueIndex("participante_jam_vaga").on(t.jamId, t.vaga),
    check("participante_papel", sql`${t.papel} in ('criador', 'convidado')`),
    check("participante_colaborador", sql`${t.colaborador} in ('ok', 'pendente', 'falhou')`),
    check("participante_vaga", sql`${t.vaga} between 1 and 3`),
  ],
);
