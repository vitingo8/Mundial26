# Sincronización automática con GitHub Actions (gratis)

El workflow [`.github/workflows/sync-wc-matches.yml`](../.github/workflows/sync-wc-matches.yml) se ejecuta **cada 5 minutos** (mínimo de GitHub). El script **no llama a football-data.org** salvo que el calendario del código (104 partidos en `groupStage.json` + eliminatorias) indique que hay un partido **en curso**:

- desde el **pitido** (`utcDate` en catálogo),
- hasta **~2 h 10 min** después (tiempo para final + prórroga y grabar resultado).

Fuera de esas ventanas el job termina al instante: **0 peticiones** a la API.

## Secretos del repositorio

En GitHub → **Settings → Secrets and variables → Actions**:

| Secreto | Valor |
|---------|--------|
| `FOOTBALL_DATA_API_KEY` | Token football-data.org |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role |

## Regenerar horarios de grupos

```bash
npm run build:fifa-catalog
```

## Probar en local

```bash
node --env-file=.env.local scripts/sync-wc-github.mjs
node --env-file=.env.local scripts/sync-wc-github.mjs --force
```

## Consumo estimado

- ~288 ejecuciones/día del workflow (gratis en GitHub).
- La mayoría duran segundos y **no** llaman a la API.
- Solo en ventanas de partido: 1 llamada cada 5 min hasta que cierra la ventana del catálogo (~26 syncs por partido como máximo).
