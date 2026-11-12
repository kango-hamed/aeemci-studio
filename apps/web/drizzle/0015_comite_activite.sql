CREATE TYPE "public"."role_comite" AS ENUM('pco', 'adjoint', 'membre');--> statement-breakpoint
CREATE TABLE "membre_comite" (
	"activite_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	"role" "role_comite" DEFAULT 'membre' NOT NULL,
	"ajoute_par" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "membre_comite_activite_id_user_id_pk" PRIMARY KEY("activite_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "membre_comite" ADD CONSTRAINT "membre_comite_activite_id_activite_id_fk" FOREIGN KEY ("activite_id") REFERENCES "public"."activite"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membre_comite" ADD CONSTRAINT "membre_comite_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membre_comite" ADD CONSTRAINT "membre_comite_ajoute_par_user_id_fk" FOREIGN KEY ("ajoute_par") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "membre_comite_un_pco" ON "membre_comite" USING btree ("activite_id") WHERE "membre_comite"."role" = 'pco';--> statement-breakpoint
CREATE UNIQUE INDEX "membre_comite_un_adjoint" ON "membre_comite" USING btree ("activite_id") WHERE "membre_comite"."role" = 'adjoint';--> statement-breakpoint
CREATE INDEX "membre_comite_user_idx" ON "membre_comite" USING btree ("user_id");