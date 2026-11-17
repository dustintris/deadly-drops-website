-- The club's flyers for DOMINATE and VICTORY (bundled with the site's images) go on their tournaments, once:
-- each only where no flyer has been chosen yet in Admin → Tournaments. They show beside the charity's flyer.
UPDATE "tournaments" SET
  "info" = "info" || jsonb_build_object('flyer', jsonb_build_object(
    'src', '/images/club/dominate-flyer.jpg',
    'alt', 'DOMINATE tournament flyer: June 13–14, 2026 divisions, rules, prizes and $55 registration, playing for the Us4Warriors Foundation'
  )),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "slug" = 'dominate-2026' AND coalesce(jsonb_typeof("info"->'flyer'), 'null') = 'null';
--> statement-breakpoint
UPDATE "tournaments" SET
  "info" = "info" || jsonb_build_object('flyer', jsonb_build_object(
    'src', '/images/club/victory-flyer.jpg',
    'alt', 'VICTORY Dink for Pink flyer: divisions, $65 registration with a pickle meal and shirt, raffle, costume prizes and sponsors'
  )),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "slug" = 'victory-dink-for-pink-2026' AND coalesce(jsonb_typeof("info"->'flyer'), 'null') = 'null';
