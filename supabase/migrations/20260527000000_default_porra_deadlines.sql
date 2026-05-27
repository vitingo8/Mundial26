-- Inicio + Especiales: 11 jun 2026, 21:00 hora de Madrid (19:00 UTC)
-- Eliminatorias: sin plazo global (bloqueo por pitido en la app)

UPDATE porra_groups
SET
  group_deadline = '2026-06-11T19:00:00.000Z'::timestamptz,
  bonus_deadline = '2026-06-11T19:00:00.000Z'::timestamptz,
  knockout_deadline = NULL;
