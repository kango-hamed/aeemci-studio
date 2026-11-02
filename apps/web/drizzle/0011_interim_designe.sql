-- Intérim déjà activé : confié au vice-président s'il n'y en a qu'un ; sinon le président le désigne.
UPDATE "mandat" SET "interimaire_id" = (
  SELECT "user_id" FROM "affectation" WHERE "affectation"."mandat_id" = "mandat"."id" AND "affectation"."role" = 'vice_president'
) WHERE "interim" AND (
  SELECT count(*) FROM "affectation" WHERE "affectation"."mandat_id" = "mandat"."id" AND "affectation"."role" = 'vice_president'
) = 1;--> statement-breakpoint
ALTER TABLE "mandat" DROP COLUMN "interim";
