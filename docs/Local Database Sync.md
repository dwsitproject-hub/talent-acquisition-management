# Local database sync

If the API returns **"Database error"** or Prisma logs mention a missing column (for example `closedAt`, `is_deleted`, `joinDate`), your Postgres volume is behind the current Prisma schema.

## Quick fix (Docker Compose)

From the project root:

```bash
docker compose exec backend npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260510120000_add_fptk_closed_at/migration.sql
docker compose exec backend npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260519120000_candidate_soft_delete/migration.sql
docker compose exec backend npx prisma db execute --schema ./prisma/schema.prisma --file ./prisma/migrations/20260508120000_add_application_join_date/migration.sql
```

Or rebuild the backend so the entrypoint applies all idempotent migrations on start:

```bash
docker compose up -d --build backend
```

## Notes

- Your curl was **POST `/api/fptk`** — that creates a **position (FPTK)**, not a candidate.
- `prisma migrate deploy` may fail if `_prisma_migrations` has old failed rows; the SQL files above use `IF NOT EXISTS` where possible.
- Fix `backend/.env` if `DATABASE_URL` contains `?schema=public?schema=public` (duplicate query string).
