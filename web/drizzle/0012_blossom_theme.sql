-- The site's colours move from Twilight to Blossom, the club owner's palette. Saved content (draft or live) that
-- still holds the exact Twilight defaults switches to the Blossom defaults; hex letter case doesn't count, and a
-- colour saved before it existed counts as unchosen. A theme with any colour the owner picked is left alone, and
-- the logo and anything else in the theme or the document are kept. This runs once, so choosing the "Twilight"
-- preset afterwards sticks. Both palettes here must match src/theme/tokens.ts (blossom-migration.test.ts checks).
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{theme}', (CASE WHEN jsonb_typeof("data"->'theme') = 'object' THEN "data"->'theme' ELSE '{}'::jsonb END) || '{
  "bg": "#0D111A", "surface": "#1A1828", "surface2": "#262036", "paper": "#F5D3DD", "paperCard": "#F9F9F9",
  "ink": "#F9F9F9", "inkDark": "#0D111A", "accent": "#ED7BAB", "accentSoft": "#F5D3DD", "accentDeep": "#E42278",
  "onAccent": "#0D111A", "accentTint": "#3A1830", "danger": "#FFA680", "dangerOnLight": "#A11D1D", "logoPlate": "#FFFFFF"
}'::jsonb), "updated_at" = now()
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_each_text('{
    "bg": "#120A2E", "surface": "#1C1142", "surface2": "#281A57", "paper": "#FDE8F3", "paperCard": "#FFFFFF",
    "ink": "#FFF4FB", "inkDark": "#1A0D22", "accent": "#FF5CB8", "accentSoft": "#D9C2FF", "accentDeep": "#A8247E",
    "onAccent": "#1A0D22", "accentTint": "#2E1440", "danger": "#FF9F85", "dangerOnLight": "#B3261E", "logoPlate": "#FFFFFF"
  }'::jsonb) AS twilight(k, v)
  WHERE upper(coalesce("data"->'theme'->>twilight.k, twilight.v)) <> upper(twilight.v)
);
