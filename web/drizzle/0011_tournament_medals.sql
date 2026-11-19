-- The medals made for VICTORY and DOMINATE (front and back in one picture, bundled with the site's images) go on
-- their tournaments, once: each only where no medal has been chosen yet in Admin → Tournaments. They show in the
-- Medal block on the tournament page.
UPDATE "tournaments" SET
  "info" = "info" || jsonb_build_object('medal', jsonb_build_object(
    'src', '/images/club/victory-medal.jpg',
    'alt', 'VICTORY medal, front and back: a horned warrior with a pumpkin, cherry blossoms and a pink ribbon; the gold back reads Dink for Pink, Oct 17–18, 2026'
  )),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "slug" = 'victory-dink-for-pink-2026' AND coalesce(jsonb_typeof("info"->'medal'), 'null') = 'null';
--> statement-breakpoint
UPDATE "tournaments" SET
  "info" = "info" || jsonb_build_object('medal', jsonb_build_object(
    'src', '/images/club/dominate-medal.jpg',
    'alt', 'DOMINATE medal, front and back: the red Deadly Drops oni on a black ring; the gold back shows a player and the year 2026'
  )),
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "slug" = 'dominate-2026' AND coalesce(jsonb_typeof("info"->'medal'), 'null') = 'null';
