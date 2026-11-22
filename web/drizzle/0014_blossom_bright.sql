-- The site's background brightens: Blossom keeps its pink, blush and off-white, over a lifted plum night instead of
-- the navy-black (the club owner asked for a brighter background in the same colours). Saved content (draft or live)
-- that still holds the exact Blossom colours switches to the brighter ones; hex letter case doesn't count, and a
-- colour saved before it existed counts as unchosen. A theme with any colour the owner picked is left alone, and the
-- logo and anything else in the theme or the document are kept. This runs once, so choosing the "Blossom deep"
-- preset afterwards sticks. Both palettes here must match src/theme/tokens.ts (blossom-bright-migration.test.ts checks).
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{theme}', (CASE WHEN jsonb_typeof("data"->'theme') = 'object' THEN "data"->'theme' ELSE '{}'::jsonb END) || '{
  "bg": "#1C1830", "surface": "#2A2443", "surface2": "#372F55", "paper": "#F5D3DD", "paperCard": "#F9F9F9",
  "ink": "#F9F9F9", "inkDark": "#0D111A", "accent": "#ED7BAB", "accentSoft": "#F5D3DD", "accentDeep": "#E42278",
  "onAccent": "#0D111A", "accentTint": "#4A2142", "danger": "#FFA680", "dangerOnLight": "#A11D1D", "logoPlate": "#FFFFFF"
}'::jsonb), "updated_at" = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_each_text('{
    "bg": "#0D111A", "surface": "#1A1828", "surface2": "#262036", "paper": "#F5D3DD", "paperCard": "#F9F9F9",
    "ink": "#F9F9F9", "inkDark": "#0D111A", "accent": "#ED7BAB", "accentSoft": "#F5D3DD", "accentDeep": "#E42278",
    "onAccent": "#0D111A", "accentTint": "#3A1830", "danger": "#FFA680", "dangerOnLight": "#A11D1D", "logoPlate": "#FFFFFF"
  }'::jsonb) AS blossom(k, v)
  WHERE upper(coalesce("data"->'theme'->>blossom.k, blossom.v)) <> upper(blossom.v)
);
