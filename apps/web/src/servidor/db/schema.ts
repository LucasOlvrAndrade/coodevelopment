import { bigint, boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
  // para outra pessoa antes de o dono antigo voltar e atualizar o dele.
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  login: text("login").notNull(),
  createdAt: criadoEm(),
  updatedAt: atualizadoEm(),
}, (t) => [index("user_login").on(t.login)]);

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
