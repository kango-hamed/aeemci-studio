CREATE TYPE "public"."action_validation" AS ENUM('soumis', 'correction_demandee', 'valide', 'nouvelle_version');--> statement-breakpoint
CREATE TYPE "public"."etat_validation" AS ENUM('redaction', 'soumis', 'a_corriger', 'valide');--> statement-breakpoint
CREATE TYPE "public"."type_administratif" AS ENUM('LET', 'PV', 'CONV', 'COM', 'ATT', 'OM');--> statement-breakpoint
ALTER TYPE "public"."origine_document" ADD VALUE 'redige';--> statement-breakpoint
CREATE TABLE "compteur" (
	"section_id" uuid NOT NULL,
	"delegation" text NOT NULL,
	"type" "type_administratif" NOT NULL,
	"annee" integer NOT NULL,
	"dernier" integer NOT NULL,
	CONSTRAINT "compteur_section_id_delegation_type_annee_pk" PRIMARY KEY("section_id","delegation","type","annee")
);
--> statement-breakpoint
CREATE TABLE "evenement_validation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"acteur_id" text,
	"action" "action_validation" NOT NULL,
	"commentaire" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signature" (
	"user_id" text PRIMARY KEY NOT NULL,
	"cle" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "type_administratif" "type_administratif";--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "contenu" jsonb;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "etat_validation" "etat_validation";--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "numero" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "valide_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "valide_par_id" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "signataires" jsonb;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "version_de_id" uuid;--> statement-breakpoint
ALTER TABLE "mandat" ADD COLUMN "interim" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "section" ADD COLUMN "cachet" text;--> statement-breakpoint
ALTER TABLE "compteur" ADD CONSTRAINT "compteur_section_id_section_id_fk" FOREIGN KEY ("section_id") REFERENCES "public"."section"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_validation" ADD CONSTRAINT "evenement_validation_document_id_document_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evenement_validation" ADD CONSTRAINT "evenement_validation_acteur_id_user_id_fk" FOREIGN KEY ("acteur_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signature" ADD CONSTRAINT "signature_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evenement_validation_document_idx" ON "evenement_validation" USING btree ("document_id","created_at");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_valide_par_id_user_id_fk" FOREIGN KEY ("valide_par_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "delegation_section_code_idx" ON "delegation" USING btree ("section_id","code");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_numero_unique" UNIQUE("numero");