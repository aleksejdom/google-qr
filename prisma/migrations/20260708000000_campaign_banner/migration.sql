-- Optionaler E-Mail-Banner pro Kampagne (Bild im Storage, hier nur Metadaten).
ALTER TABLE "Campaign" ADD COLUMN "bannerType" TEXT;
ALTER TABLE "Campaign" ADD COLUMN "bannerLink" TEXT;
