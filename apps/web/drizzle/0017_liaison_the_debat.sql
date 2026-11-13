ALTER TABLE "activite" ADD COLUMN "debat_edition_id" text;--> statement-breakpoint
ALTER TABLE "activite" ADD COLUMN "debat_resultats" jsonb;--> statement-breakpoint
ALTER TABLE "activite" ADD COLUMN "debat_recupere_le" timestamp with time zone;