-- Klick-Tracking: wann der personalisierte Bewertungslink zuerst geoeffnet wurde.
ALTER TABLE "ReviewRequest" ADD COLUMN "openedAt" TIMESTAMP(3);
