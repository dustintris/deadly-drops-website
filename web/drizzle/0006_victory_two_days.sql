-- VICTORY: Dink for Pink ran over two days (October 17 and 18), not one, and players text Cherry with
-- their pickle meal choice. The tournament row was imported from the seed before either was known, so
-- fix the saved row once. Each change applies only while the value is still exactly what the seed
-- wrote: anything the owner has changed in Admin → Tournaments is left alone. Divisions stay on day 1.
UPDATE "tournaments" SET
  "days" = CASE WHEN "days" = ARRAY['2026-10-17']::date[] THEN ARRAY['2026-10-17', '2026-10-18']::date[] ELSE "days" END,
  "info" = "info"
    || CASE WHEN "info"->>'dateLabel' = 'Sat, Oct 17, 2026' THEN jsonb_build_object('dateLabel', 'Oct 17–18, 2026') ELSE '{}'::jsonb END
    || CASE WHEN "info"->>'summary' LIKE '%a one-day Breast Cancer and Halloween Bash%'
       THEN jsonb_build_object('summary', replace("info"->>'summary', 'a one-day Breast Cancer', 'a two-day Breast Cancer'))
       ELSE '{}'::jsonb END,
  -- checked in order (a CASE, not AND), so the array functions only ever see an array; at most 20 notes
  "rules" = CASE
    WHEN jsonb_typeof(coalesce("rules"->'notes', '[]'::jsonb)) <> 'array' THEN "rules"
    WHEN jsonb_array_length(coalesce("rules"->'notes', '[]'::jsonb)) >= 20 THEN "rules"
    WHEN EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce("rules"->'notes', '[]'::jsonb)) AS n WHERE n->>'id' = 'pickle-meal') THEN "rules"
    ELSE jsonb_set("rules", '{notes}', coalesce("rules"->'notes', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'id', 'pickle-meal',
      'title', 'Pickle meal',
      'text', 'Text Cherry at (619) 988-4244 with your pickle meal of choice. Pickle meals and t-shirts are handed out at check-in.'
    )))
  END,
  "version" = "version" + 1,
  "updated_at" = now()
WHERE "slug" = 'victory-dink-for-pink-2026';
