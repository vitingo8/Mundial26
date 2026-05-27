-- Eliminatorias (porra real, 40%): cierre 28 jun 2026, 21:00 Madrid (19:00 UTC, partido 73)

UPDATE porra_groups
SET knockout_deadline = '2026-06-28T19:00:00.000Z'::timestamptz
WHERE knockout_deadline IS NULL;
