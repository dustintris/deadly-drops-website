-- The site was built from a mockup whose settings carried a "Preview build · member names and ratings are sample
-- content" banner and a 15% member discount for a checkout that no longer exists. The seed no longer has them, but a
-- draft (or live copy) saved before launch still does, and publishing Club info would bring the banner back.
-- Each value is retired only where it is still exactly the mockup's, so anything the owner wrote stays as it is.
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{settings,notice}', jsonb_build_object('enabled', false, 'text', '')), "updated_at" = now()
WHERE "data"->'settings'->'notice'->>'text' = 'Preview build · member names and ratings are sample content';
--> statement-breakpoint
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{settings,shop,memberDiscount}', '0'::jsonb), "updated_at" = now()
WHERE jsonb_typeof("data"->'settings'->'shop'->'memberDiscount') = 'number'
  AND ("data"->'settings'->'shop'->>'memberDiscount')::numeric = 0.15;
--> statement-breakpoint
-- the shop is a catalogue now: an empty "how to buy" note gets the one the seed has
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{settings,shop,pickupNote}', to_jsonb('Buy at tournament check-in, or message us to hold your size.'::text)), "updated_at" = now()
WHERE jsonb_typeof("data"->'settings'->'shop') = 'object'
  AND coalesce("data"->'settings'->'shop'->>'pickupNote', '') = '';
