DROP INDEX "account_user_id";--> statement-breakpoint
CREATE UNIQUE INDEX "account_provider_account" ON "account" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_user_provider" ON "account" USING btree ("user_id","provider_id");