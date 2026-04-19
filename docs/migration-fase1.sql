-- ================================================================
--  Cantinho Nerd — Migration Fase 1
--  Multi-sistema: D&D 5e + Ordem Paranormal
--
--  Execute este script no SQL Editor do Supabase:
--  https://supabase.com/dashboard → seu projeto → SQL Editor
-- ================================================================


-- ----------------------------------------------------------------
-- 1. Coluna `system` na tabela sessions
--    DEFAULT 'dnd5e' garante que sessões existentes não quebrem.
-- ----------------------------------------------------------------
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS system TEXT NOT NULL DEFAULT 'dnd5e';


-- ----------------------------------------------------------------
-- 2. Tabela character_sheets
--    Armazena a ficha de qualquer sistema como JSONB.
--    O campo `system` da sessão indica qual schema esperar.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS character_sheets (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID        NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  player_id   UUID        NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  data        JSONB       NOT NULL DEFAULT '{}',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, player_id)
);

ALTER TABLE character_sheets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_character_sheets" ON character_sheets;
CREATE POLICY "allow_all_character_sheets"
  ON character_sheets FOR ALL USING (true);

-- Realtime para fichas (opcional, útil se quiser sync ao vivo)
ALTER PUBLICATION supabase_realtime ADD TABLE character_sheets;


-- ----------------------------------------------------------------
-- 3. Tabela session_messages (chat)
--    Pode já existir — o IF NOT EXISTS protege contra erro.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_messages (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID        NOT NULL REFERENCES sessions(id)  ON DELETE CASCADE,
  player_id             UUID        NOT NULL REFERENCES players(id)   ON DELETE CASCADE,
  player_name           TEXT        NOT NULL,
  player_avatar         TEXT,
  content               TEXT        NOT NULL,
  is_whisper            BOOLEAN     NOT NULL DEFAULT false,
  whisper_to_player_id  UUID        REFERENCES players(id),
  whisper_to_name       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE session_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_all_session_messages" ON session_messages;
CREATE POLICY "allow_all_session_messages"
  ON session_messages FOR ALL USING (true);

-- Realtime para o chat
ALTER PUBLICATION supabase_realtime ADD TABLE session_messages;


-- ----------------------------------------------------------------
-- 4. Verificação final — deve retornar as 3 tabelas/colunas
-- ----------------------------------------------------------------
SELECT
  'sessions.system'    AS item, data_type
  FROM information_schema.columns
  WHERE table_name = 'sessions' AND column_name = 'system'
UNION ALL
SELECT 'character_sheets', 'table exists'
  FROM information_schema.tables
  WHERE table_name = 'character_sheets'
UNION ALL
SELECT 'session_messages', 'table exists'
  FROM information_schema.tables
  WHERE table_name = 'session_messages';
