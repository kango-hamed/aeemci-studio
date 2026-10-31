CREATE TYPE "public"."origine_document" AS ENUM('genere', 'depose');--> statement-breakpoint
CREATE TYPE "public"."statut_document" AS ENUM('brouillon', 'publie');--> statement-breakpoint
CREATE TYPE "public"."visibilite_document" AS ENUM('bureau', 'delegation', 'section');--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "revision_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "plan" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "valeurs" SET DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "largeur" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "hauteur" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ALTER COLUMN "miniature" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "origine" "origine_document" DEFAULT 'genere' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "statut" "statut_document" DEFAULT 'publie' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "visibilite" "visibilite_document" DEFAULT 'delegation' NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "declinaisons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "nom_fichier" text;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "taille" integer;