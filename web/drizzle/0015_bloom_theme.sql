-- The site's colours become "Bloom": a light blush page with the pink, purple, lavender and honeydew of the palette
-- the owner picked for the Beauty in the Beast season (in place of Blossom's plum night). Saved content (draft or
-- live) still on the Blossom-bright colours switches to Bloom; hex letter case doesn't count, a colour saved before it
-- existed counts as unchosen, and the "Initials tiles" tint (accentTint) is not compared: no page uses it, and the
-- live theme had it changed with no visible effect. A theme with any other colour the owner picked is left alone, and
-- the logo and anything else in the theme or the document are kept. This runs once, so choosing the "Blossom"
-- preset afterwards sticks. Both palettes here must match src/theme/tokens.ts (bloom-migration.test.ts checks).
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{theme}', (CASE WHEN jsonb_typeof("data"->'theme') = 'object' THEN "data"->'theme' ELSE '{}'::jsonb END) || '{
  "bg": "#F7E4EA", "surface": "#F5D3DD", "surface2": "#F0FFF0", "paper": "#F3C1D0", "paperCard": "#F0FFF0",
  "ink": "#0D111A", "inkDark": "#0D111A", "accent": "#FF77B7", "accentSoft": "#E1B7E3", "accentDeep": "#A95BC8",
  "onAccent": "#0D111A", "accentTint": "#D0E8D0", "danger": "#A11D1D", "dangerOnLight": "#A11D1D", "logoPlate": "#FFFFFF"
}'::jsonb), "updated_at" = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_each_text('{
    "bg": "#1C1830", "surface": "#2A2443", "surface2": "#372F55", "paper": "#F5D3DD", "paperCard": "#F9F9F9",
    "ink": "#F9F9F9", "inkDark": "#0D111A", "accent": "#ED7BAB", "accentSoft": "#F5D3DD", "accentDeep": "#E42278",
    "onAccent": "#0D111A", "accentTint": "#4A2142", "danger": "#FFA680", "dangerOnLight": "#A11D1D", "logoPlate": "#FFFFFF"
  }'::jsonb) AS blossom(k, v)
  WHERE blossom.k <> 'accentTint'
    AND upper(coalesce("data"->'theme'->>blossom.k, blossom.v)) <> upper(blossom.v)
);
