CREATE TABLE "invitation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"empreinte" text NOT NULL,
	"expire_le" timestamp with time zone NOT NULL,
	"utilisee_le" timestamp with time zone,
	"cree_par_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_empreinte_unique" UNIQUE("empreinte")
);
--> statement-breakpoint
ALTER TABLE "delegation" ADD COLUMN "archivee" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "mandat_id" uuid;--> statement-breakpoint
ALTER TABLE "document" ADD COLUMN "delegation_id" uuid;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_cree_par_id_user_id_fk" FOREIGN KEY ("cree_par_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invitation_user_idx" ON "invitation" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_mandat_id_mandat_id_fk" FOREIGN KEY ("mandat_id") REFERENCES "public"."mandat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document" ADD CONSTRAINT "document_delegation_id_delegation_id_fk" FOREIGN KEY ("delegation_id") REFERENCES "public"."delegation"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_delegation_idx" ON "document" USING btree ("delegation_id","created_at");