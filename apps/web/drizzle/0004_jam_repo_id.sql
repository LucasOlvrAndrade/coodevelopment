DROP INDEX "jam_repo_aberta";--> statement-breakpoint
ALTER TABLE "jam" ADD COLUMN "repo_id" bigint NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "jam_repo_aberta" ON "jam" USING btree ("repo_id") WHERE "jam"."estado" <> 'fechada';