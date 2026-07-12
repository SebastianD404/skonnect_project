# Migration Safety Guidelines

Purpose: avoid destructive or irreversible database commands (especially `migrate reset`) on shared, staging, or production databases.

Quick rules
- NEVER run `npx prisma migrate reset` or any command that drops the production or shared database. Only use `migrate reset` on disposable local dev databases you are prepared to lose.
- Do NOT modify migration files that are already applied to a shared database. If you need schema changes, create a new migration.
- Require a backup (snapshot/dump) and a second reviewer before applying migrations to staging or production.

Safe commands and alternatives
- Inspect migration status and drift:

```bash
npx prisma migrate status
npx prisma migrate resolve --help
```

- If a migration file was edited after being applied to the DB, do NOT run `migrate dev`. Instead, verify schema and use one of these:

```bash
# If DB already has the changes and you want Prisma to mark the migration as applied:
npx prisma migrate resolve --applied "<migration_name>"

# To deploy migrations (non-interactive) in production from migration files:
npx prisma migrate deploy
```

- If shadow DB creation fails for CI/dev, set a dedicated shadow DB and re-run migrations:

```bash
# Bash
export SHADOW_DATABASE_URL="postgresql://user:pass@localhost:5432/shadow_db"
npx prisma migrate dev

# PowerShell
$env:SHADOW_DATABASE_URL='postgresql://user:pass@localhost:5432/shadow_db'
npx prisma migrate dev
```

How to resolve drift safely
1. Run `npx prisma migrate status` to see drift and which migrations differ.
2. Pull the actual DB schema for inspection (non-destructive):

```bash
npx prisma db pull --print
```

3. Compare `schema.prisma` vs. pulled schema. If the DB already contains the desired changes, use `npx prisma migrate resolve --applied` for the migrations that are blocking (only after manual verification and backups).

4. If the DB does not have the changes, create new migration files (do not edit applied migrations), test on staging, then run `npx prisma migrate deploy` on production.

Checklist before applying migrations to shared/staging/production
- Take a DB backup (snapshot or `pg_dump`).
- Run migrations on a staging environment first and verify application behavior.
- Confirm `SHADOW_DATABASE_URL` is set for CI where needed.
- Get a second engineer or DBA to review the migration PR.

Emergency: if a migration has already broken the deployment
- Stop further deploys and notify the team/db owner.
- Restore from backup if required.
- Use `npx prisma migrate resolve --rolled-back` only under guidance of a DBA and after understanding the state.

Notes and best practices
- Treat migrations as immutable once applied to a shared database. Create additive migrations for changes.
- Keep migrations in version control and include a descriptive name and PR justification.
- Add test coverage or at least a dev/staging smoke test that runs after migrations.

If you want, I can add a CI job snippet that runs `npx prisma migrate status` and fails the pipeline if drift is detected.
