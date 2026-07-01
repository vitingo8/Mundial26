-- ============================================================
-- PORRA MUNDIAL 2026 - Supabase Schema
-- Ejecutar en: Supabase Dashboard > SQL Editor
--
-- Si la base YA EXISTE, no ejecutes todo el archivo: usa solo
-- las líneas ALTER TABLE de la sección "Migración" más abajo.
-- ============================================================

-- Grupos de porra
CREATE TABLE IF NOT EXISTS porra_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_id TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'group', -- 'group' | 'knockout' | 'finished'
  group_deadline TIMESTAMPTZ,          -- fecha tope porra inicial
  knockout_deadline TIMESTAMPTZ,       -- fecha tope porra eliminatorias
  bonus_deadline TIMESTAMPTZ,          -- fecha tope predicciones especiales
  actuals JSONB DEFAULT '{}',          -- resultados reales (goleador, MVP...)
  results JSONB DEFAULT '{"group":{}, "knockout":{}}',
  results_updated_at JSONB DEFAULT '{"group":{}, "knockout":{}}', -- { [matchId]: { t: ISO } } última vez que cambió cada resultado
  league_logo TEXT,                    -- logo de la liga / porra (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Participantes (un JSON por usuario)
CREATE TABLE IF NOT EXISTS porra_participants (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES porra_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,                 -- obligatorio; recuperación de cuenta
  is_admin BOOLEAN DEFAULT FALSE,
  predictions JSONB DEFAULT '{"group":{}, "knockout":{}, "bonuses":{}}',
  pin_hash TEXT,                         -- hash SHA-256 del PIN opcional (re-entrada)
  team_name TEXT,                        -- nombre del equipo en la porra (opcional)
  team_logo TEXT,                        -- data URL del escudo (opcional)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migración si la tabla ya existe:
-- ALTER TABLE porra_participants ADD COLUMN IF NOT EXISTS team_name TEXT;
-- ALTER TABLE porra_participants ADD COLUMN IF NOT EXISTS team_logo TEXT;
-- ALTER TABLE porra_participants ADD COLUMN IF NOT EXISTS pin_hash TEXT;
-- UPDATE porra_participants SET email = 'pendiente+' || id || '@local.invalid' WHERE email IS NULL;
-- ALTER TABLE porra_participants ALTER COLUMN email SET NOT NULL;
-- CREATE INDEX IF NOT EXISTS idx_participants_email ON porra_participants(email);
-- ALTER TABLE porra_groups ADD COLUMN IF NOT EXISTS bonus_deadline TIMESTAMPTZ;
-- ALTER TABLE porra_groups ADD COLUMN IF NOT EXISTS league_logo TEXT;
-- ALTER TABLE porra_groups ADD COLUMN IF NOT EXISTS results_updated_at JSONB DEFAULT '{"group":{}, "knockout":{}}';

-- Índices
CREATE INDEX IF NOT EXISTS idx_participants_group ON porra_participants(group_id);

-- RLS (Row Level Security) - acceso público con anon key
ALTER TABLE porra_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE porra_participants ENABLE ROW LEVEL SECURITY;

-- Policies: lectura y escritura pública (la autenticación es por ID de grupo/usuario)
-- DROP IF EXISTS permite re-ejecutar el schema sin error si ya existían.
DROP POLICY IF EXISTS "Public read groups" ON porra_groups;
DROP POLICY IF EXISTS "Public insert groups" ON porra_groups;
DROP POLICY IF EXISTS "Public update groups" ON porra_groups;
CREATE POLICY "Public read groups" ON porra_groups FOR SELECT USING (true);
CREATE POLICY "Public insert groups" ON porra_groups FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update groups" ON porra_groups FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read participants" ON porra_participants;
DROP POLICY IF EXISTS "Public insert participants" ON porra_participants;
DROP POLICY IF EXISTS "Public update participants" ON porra_participants;
CREATE POLICY "Public read participants" ON porra_participants FOR SELECT USING (true);
CREATE POLICY "Public insert participants" ON porra_participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update participants" ON porra_participants FOR UPDATE USING (true);
