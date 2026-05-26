-- Logo del grupo en cabecera (data URL JPEG comprimido)
ALTER TABLE porra_groups ADD COLUMN IF NOT EXISTS league_logo TEXT;
