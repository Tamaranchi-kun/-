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

## Setup / Provisioning

This project depends on a Supabase Postgres database, Supabase Storage, and several
environment variables. The schema is reproducible from version control — do **not**
make manual schema changes in production without also updating the SQL files here.

### 1. Environment variables

Copy the template and fill in real values:

```bash
cp .env.example .env.local
```

For production, register the **same** keys in Vercel under
**Project Settings → Environment Variables**. In particular:

- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public anon key (browser-safe, used for the quiz `scores`).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only secret**, never expose it. Used by the
  admin/email APIs to bypass RLS. Keep it out of `NEXT_PUBLIC_*`.

See `.env.example` for the full list and a description of each variable.

### 2. Provision the database schema

Open **Supabase Dashboard → SQL Editor**, paste the full contents of
[`supabase_schema_provisioning.sql`](./supabase_schema_provisioning.sql), and run it.

This file is **idempotent** (uses `IF NOT EXISTS` / `ON CONFLICT` / guarded
`DO $$ ... $$` blocks), so it is safe to run against the existing production DB —
it creates anything missing and leaves existing objects untouched. It provisions:

- the email tables (`email_lists`, `email_campaigns`, `email_events`,
  `email_list_groups`, `email_list_members`) and their indexes,
- scheduled-send / consent columns and the orphan-preventing junction FK,
- the quiz `scores` table with RLS (anon may INSERT valid rows and SELECT, but not
  UPDATE/DELETE),
- the public `email-images` Storage bucket.

### 3. Lock down PII (required)

Apply [`supabase_rls_emergency.sql`](./supabase_rls_emergency.sql) in the SQL Editor.
This enables Row Level Security on every `email_*` table so the public anon key can
no longer read/write/delete customer PII via PostgREST. The `service_role` key
(used by the server-side admin APIs) bypasses RLS and is unaffected. **This step is
mandatory** — without it the recipient PII is publicly exposed.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
