-- The site's colours move from the original lime design to Twilight. Saved content that still holds
-- the exact original lime defaults (the seed wrote them in) switches to the Twilight defaults; a theme
-- with any colour the owner picked is left alone, and the logo is kept. This runs once, so choosing the
-- "Lime (original design)" preset afterwards sticks.
UPDATE "site_documents"
SET "data" = jsonb_set("data", '{theme}', (CASE WHEN jsonb_typeof("data"->'theme') = 'object' THEN "data"->'theme' ELSE '{}'::jsonb END) || '{
  "bg": "#120A2E", "surface": "#1C1142", "surface2": "#281A57", "paper": "#FDE8F3", "paperCard": "#FFFFFF",
  "ink": "#FFF4FB", "inkDark": "#1A0D22", "accent": "#FF5CB8", "accentSoft": "#D9C2FF", "accentDeep": "#A8247E",
  "onAccent": "#1A0D22", "accentTint": "#2E1440", "danger": "#FF9F85", "dangerOnLight": "#B3261E", "logoPlate": "#FFFFFF"
}'::jsonb)
WHERE NOT EXISTS (
  SELECT 1
  FROM jsonb_each_text('{
    "bg": "#080808", "surface": "#111111", "surface2": "#181818", "paper": "#F2F2EE", "paperCard": "#FFFFFF",
    "ink": "#F4F4F2", "inkDark": "#111111", "accent": "#C6F24E", "accentSoft": "#E4FBA6", "accentDeep": "#8FC21F",
    "onAccent": "#111111", "accentTint": "#1F2418", "danger": "#FF8F8F", "dangerOnLight": "#B3261E", "logoPlate": "#FFFFFF"
  }'::jsonb) AS lime(k, v)
  WHERE upper(coalesce("data"->'theme'->>lime.k, lime.v)) <> upper(lime.v)
);
