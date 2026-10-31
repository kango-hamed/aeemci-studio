CREATE TABLE "activite" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandat_id" uuid NOT NULL,
	"delegation_id" uuid,
	"auteur_id" text NOT NULL,
	"titre" text NOT NULL,
	"date" text NOT NULL,
	"heure" text,
	"lieu" text,
	"description" text,
	"bilan" text,
	"visibilite" "visibilite_document" DEFAULT 'section' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_passation" (
	"mandat_id" uuid NOT NULL,
	"cle" text NOT NULL,
	"texte" text NOT NULL,
	"auteur_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "note_passation_mandat_id_cle_pk" PRIMARY KEY("mandat_id","cle")
);
--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "activite_id" uuid;--> statement-breakpoint
ALTER TABLE "activite" ADD CONSTRAINT "activite_mandat_id_mandat_id_fk" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activite" ADD CONSTRAINT "activite_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activite" ADD CONSTRAINT "activite_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_passation" ADD CONSTRAINT "note_passation_mandat_id_mandat_id_fk" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_passation" ADD CONSTRAINT "note_passation_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activite_mandat_idx" ON "activite" USING btree ("mandat_id","date");--> statement-breakpoint
CREATE INDEX "activite_delegation_idx" ON "activite" USING btree ("delegation_id","date");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_activite_id_activite_id_fk" FOREIGN KEY ("activite_id") REFERENCES "public"."activite"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_activite_idx" ON "document" USING btree ("activite_id");--> statement-breakpoint
CREATE INDEX "document_mandat_idx" ON "document" USING btree ("mandat_id");