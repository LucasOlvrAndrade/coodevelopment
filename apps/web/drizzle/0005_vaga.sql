ALTER TABLE "participante" ADD COLUMN "vaga" smallint NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "participante_jam_vaga" ON "participante" USING btree ("jam_id","vaga");--> statement-breakpoint
ALTER TABLE "participante" ADD CONSTRAINT "participante_vaga" CHECK ("participante"."vaga" between 1 and 3);