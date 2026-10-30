CREATE TABLE "document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auteur_id" text NOT NULL,
	"revision_id" uuid NOT NULL,
	"titre" text NOT NULL,
	"plan" text NOT NULL,
	"valeurs" jsonb NOT NULL,
	"fichier" text NOT NULL,
	"type" text NOT NULL,
	"largeur" integer NOT NULL,
	"hauteur" integer NOT NULL,
	"miniature" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gabarit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"actif" boolean DEFAULT true NOT NULL,
	"revision_courante_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gabarit_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "revision_gabarit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gabarit_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"contenu" jsonb NOT NULL,
	"prefixe" text NOT NULL,
	"vignette" text,
	"revision_atelier" integer,
	"importe_par_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "televersement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"cle" text NOT NULL,
	"type" text NOT NULL,
	"taille" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_auteur_id_user_id_fk" FOREIGN KEY ("auteur_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_revision_id_revision_gabarit_id_fk" FOREIGN KEY ("revision_id") REFERENCES "public"."revision_gabarit"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_gabarit" ADD CONSTRAINT "revision_gabarit_gabarit_id_gabarit_id_fk" FOREIGN KEY ("gabarit_id") REFERENCES "public"."gabarit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_gabarit" ADD CONSTRAINT "revision_gabarit_importe_par_id_user_id_fk" FOREIGN KEY ("importe_par_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "televersement" ADD CONSTRAINT "televersement_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_auteur_idx" ON "document" USING btree ("auteur_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_gabarit_numero_idx" ON "revision_gabarit" USING btree ("gabarit_id","numero");--> statement-breakpoint
CREATE INDEX "televersement_user_idx" ON "televersement" USING btree ("user_id");