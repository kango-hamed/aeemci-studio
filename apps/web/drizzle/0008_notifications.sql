CREATE TABLE "abonnement_notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"appareil" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "abonnement_notification_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "preference_notification" (
	"user_id" text PRIMARY KEY NOT NULL,
	"a_valider" boolean DEFAULT true NOT NULL,
	"decision" boolean DEFAULT true NOT NULL,
	"partage" boolean DEFAULT true NOT NULL,
	"rappel" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activite" ADD COLUMN "rappel_envoye_le" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "abonnement_notification" ADD CONSTRAINT "abonnement_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "preference_notification" ADD CONSTRAINT "preference_notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonnement_notification_user_idx" ON "abonnement_notification" USING btree ("user_id");