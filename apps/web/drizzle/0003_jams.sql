CREATE TABLE "jam" (
	"id" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"repo_owner" text NOT NULL,
	"repo_nome" text NOT NULL,
	"branch" text NOT NULL,
	"criador_id" text NOT NULL,
	"estado" text DEFAULT 'aberta' NOT NULL,
	"base_sha" text NOT NULL,
	"primeira_mudanca_em" timestamp with time zone,
	"ultimo_commit_em" timestamp with time zone,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "jam_estado" CHECK ("jam"."estado" in ('aberta', 'fechando', 'fechada'))
);
--> statement-breakpoint
CREATE TABLE "participante" (
	"jam_id" text NOT NULL,
	"usuario_id" text NOT NULL,
	"papel" text NOT NULL,
	"colaborador" text DEFAULT 'pendente' NOT NULL,
	"entrou_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participante_jam_usuario" PRIMARY KEY("jam_id","usuario_id"),
	CONSTRAINT "participante_papel" CHECK ("participante"."papel" in ('criador', 'convidado')),
	CONSTRAINT "participante_colaborador" CHECK ("participante"."colaborador" in ('ok', 'pendente', 'falhou'))
);
--> statement-breakpoint
ALTER TABLE "jam" ADD CONSTRAINT "jam_criador_id_user_id_fk" FOREIGN KEY ("criador_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_jam_id_jam_id_fk" FOREIGN KEY ("jam_id") REFERENCES "public"."jam"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_usuario_id_user_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "jam_repo" ON "jam" USING btree ("repo_owner","repo_nome");--> statement-breakpoint
CREATE UNIQUE INDEX "jam_repo_aberta" ON "jam" USING btree (lower("repo_owner"),lower("repo_nome")) WHERE "jam"."estado" <> 'fechada';--> statement-breakpoint
CREATE INDEX "participante_usuario" ON "participante" USING btree ("usuario_id");