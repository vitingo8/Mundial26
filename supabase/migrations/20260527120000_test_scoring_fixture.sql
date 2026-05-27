-- Grupo de prueba de puntuación (ids _test_*). No sincroniza con football-data.org.
-- Ejecutar seed completo: node --env-file=.env.local scripts/seed-test-scoring.mjs

-- Solo marca el grupo; el script seed-test-scoring.mjs escribe JSON completo.
-- Puedes borrarlo con:
--   DELETE FROM porra_participants WHERE group_id = '_test_scoring';
--   DELETE FROM porra_groups WHERE id = '_test_scoring';
