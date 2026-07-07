-- Einwilligungsfelder fuer E-Mail-Anfragen (DSGVO-Nachweis) am Kontakt.
-- consentToken muss fuer Bestandszeilen per SQL befuellt werden,
-- da Prismas cuid()-Default nur clientseitig bei neuen Zeilen greift.
ALTER TABLE "Contact" ADD COLUMN "consentAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "consentConfirmedAt" TIMESTAMP(3);
ALTER TABLE "Contact" ADD COLUMN "consentText" TEXT;
ALTER TABLE "Contact" ADD COLUMN "consentToken" TEXT;

UPDATE "Contact"
SET "consentToken" = 'c' || md5(random()::text || clock_timestamp()::text || id);

ALTER TABLE "Contact" ALTER COLUMN "consentToken" SET NOT NULL;

CREATE UNIQUE INDEX "Contact_consentToken_key" ON "Contact"("consentToken");
