CREATE TABLE "amizade" (
	"usuario_a" text NOT NULL,
	"usuario_b" text NOT NULL,
	"criada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "amizade_par" PRIMARY KEY("usuario_a","usuario_b"),
	CONSTRAINT "amizade_par_em_ordem" CHECK ("amizade"."usuario_a" < "amizade"."usuario_b")
);
--> statement-breakpoint
CREATE TABLE "pedido_amizade" (
	"id" text PRIMARY KEY NOT NULL,
	"de" text NOT NULL,
	"para" text NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedido_amizade_de_para" UNIQUE("de","para"),
	CONSTRAINT "pedido_amizade_status" CHECK ("pedido_amizade"."status" in ('pendente', 'recusado')),
	CONSTRAINT "pedido_amizade_outra_pessoa" CHECK ("pedido_amizade"."de" <> "pedido_amizade"."para")
);
--> statement-breakpoint
DROP INDEX "user_login";--> statement-breakpoint
ALTER TABLE "amizade" ADD CONSTRAINT "amizade_usuario_a_user_id_fk" FOREIGN KEY ("usuario_a") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amizade" ADD CONSTRAINT "amizade_usuario_b_user_id_fk" FOREIGN KEY ("usuario_b") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_amizade" ADD CONSTRAINT "pedido_amizade_de_user_id_fk" FOREIGN KEY ("de") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_amizade" ADD CONSTRAINT "pedido_amizade_para_user_id_fk" FOREIGN KEY ("para") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amizade_usuario_b" ON "amizade" USING btree ("usuario_b");--> statement-breakpoint
CREATE INDEX "pedido_amizade_para" ON "pedido_amizade" USING btree ("para");--> statement-breakpoint
CREATE INDEX "user_login_lower" ON "user" USING btree (lower("login"));