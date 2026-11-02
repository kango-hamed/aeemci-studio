ALTER TYPE "public"."role" ADD VALUE 'sous_responsable_delegation' BEFORE 'membre';--> statement-breakpoint
ALTER TABLE "mandat" ADD COLUMN "interimaire_id" text;--> statement-breakpoint
ALTER TABLE "mandat" ADD CONSTRAINT "mandat_interimaire_id_user_id_fk" FOREIGN KEY ("interimaire_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;