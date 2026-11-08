CREATE TABLE "journal_suppression" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quoi" text NOT NULL,
	"objet_id" uuid NOT NULL,
	"libelle" text NOT NULL,
	"par_id" text,
	"par_nom" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_suppression" ADD CONSTRAINT "journal_suppression_par_id_user_id_fk" FOREIGN KEY ("par_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_suppression_date_idx" ON "journal_suppression" USING btree ("created_at");