This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

### Prisma database migrations

Keep schema changes in committed Prisma migrations; do not use `prisma db push` against production.

1. Make schema changes against a development database and create a migration:

   ```bash
   npx prisma migrate dev --name describe_the_change
   ```

2. Review and commit the generated `prisma/migrations` directory together with `prisma/schema.prisma`.
3. Before a production release, back up the database and check the production migration status:

   ```bash
   npm run db:status
   ```

4. Apply pending migrations to the production database, then deploy the application:

   ```bash
   npm run db:deploy
   npm run build
   ```

5. Confirm `npm run db:status` reports that the database is up to date. In Vercel, configure the production environment with the correct `DATABASE_URL` and `DIRECT_URL`; keep preview/staging deployments connected to a separate database. Use a direct or session-mode database connection for migrations, not a transaction-pool URL.

`db:deploy` applies committed, unapplied migrations; it does not create migrations or repair schema drift. If migration status reports failed migrations or drift, stop and investigate before deploying rather than using `db push` or manually changing migration history.

### Synthetic demo data

The demo seed rebuilds only synthetic users ending in `@demo.skonnect.invalid`. It creates 40 pending KK profiling applications, 50 waitlisted SKEAP applications, and 30 pending SKEAP applications, along with approved profiles and any available active scholar slots. Faker is already included as a development dependency.

Run this only against a local development database. The seed requires `SEED_DEMO_DATA=true`, refuses production, and blocks remote database hosts by default.

```powershell
$env:SEED_DEMO_DATA = "true"
npm run db:seed:demo
Remove-Item Env:SEED_DEMO_DATA
```

### Payout confirmation email links

Set `NEXT_PUBLIC_APP_URL` to the canonical public origin of the deployed app (for example, `https://skonnect.example`). Vercel deployments can use the platform-provided `VERCEL_URL`. Local development falls back to `http://localhost:3000`; that link is only reachable from the developer's own machine. After correcting the URL, retry the payout email from Admin Accounting without disbursing the payout again.

### Private application documents

KK profiling identity/residency documents and SKEAP application uploads use the private `private-documents` Supabase Storage bucket. Before deploying these upload changes, configure the target environment's Supabase URL and server-only `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, then create the bucket:

```bash
npm run storage:private-documents:setup
```

Existing sensitive uploads in the public `public image` bucket must also be migrated. First run the migration in dry-run mode, review the number of objects, then apply it against the intended database and Supabase project:

```bash
npm run storage:private-documents:migrate
npm run storage:private-documents:migrate -- --apply
```

The migration updates database references and removes the corresponding public objects. Do not remove the legacy public-read policy until all other intentionally public assets have been verified.
