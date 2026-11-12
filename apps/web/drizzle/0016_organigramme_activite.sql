CREATE TYPE "public"."role_equipe" AS ENUM('responsable', 'adjoint', 'membre');--> statement-breakpoint
CREATE TABLE "activite_equipe" (
	"activite_id" uuid NOT NULL,
	"equipe_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activite_equipe_activite_id_equipe_id_pk" PRIMARY KEY("activite_id","equipe_id")
);
--> statement-breakpoint
CREATE TABLE "equipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mandat_id" uuid NOT NULL,
	"activite_id" uuid,
	"nom" text NOT NULL,
	"ordre" integer DEFAULT 0 NOT NULL,
	"cree_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "membre_equipe" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equipe_id" uuid NOT NULL,
	"role" "role_equipe" DEFAULT 'membre' NOT NULL,
	"nom" text NOT NULL,
	"telephone" text,
	"ordre" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activite_equipe" ADD CONSTRAINT "activite_equipe_activite_id_activite_id_fk" FOREIGN KEY ("activite_id") REFERENCES "public"."activite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activite_equipe" ADD CONSTRAINT "activite_equipe_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_mandat_id_mandat_id_fk" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_activite_id_activite_id_fk" FOREIGN KEY ("activite_id") REFERENCES "public"."activite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipe" ADD CONSTRAINT "equipe_cree_par_user_id_fk" FOREIGN KEY ("cree_par") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membre_equipe" ADD CONSTRAINT "membre_equipe_equipe_id_equipe_id_fk" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipe"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "equipe_mandat_idx" ON "equipe" USING btree ("mandat_id");--> statement-breakpoint
CREATE INDEX "equipe_activite_idx" ON "equipe" USING btree ("activite_id");--> statement-breakpoint
CREATE INDEX "membre_equipe_equipe_idx" ON "membre_equipe" USING btree ("equipe_id");