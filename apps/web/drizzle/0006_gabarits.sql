CREATE TABLE "gabarit_delegation" (
	"gabarit_id" uuid NOT NULL,
	"delegation_id" uuid NOT NULL,
	CONSTRAINT "gabarit_delegation_gabarit_id_delegation_id_pk" PRIMARY KEY("gabarit_id","delegation_id")
);
--> statement-breakpoint
ALTER TABLE "revision_gabarit" ALTER COLUMN "numero" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "affectation" ADD COLUMN "designer" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "revision_gabarit" ADD COLUMN "publiee_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "revision_gabarit" ADD COLUMN "publiee_par_id" text;--> statement-breakpoint
ALTER TABLE "gabarit_delegation" ADD CONSTRAINT "gabarit_delegation_gabarit_id_gabarit_id_fk" FOREIGN KEY ("gabarit_id") REFERENCES "public"."gabarit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gabarit_delegation" ADD CONSTRAINT "gabarit_delegation_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_gabarit" ADD CONSTRAINT "revision_gabarit_publiee_par_id_user_id_fk" FOREIGN KEY ("publiee_par_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
-- Les révisions importées avant le lot 6 étaient publiées dès l'import.
UPDATE "revision_gabarit" SET "publiee_le" = "created_at", "publiee_par_id" = "importe_par_id";
