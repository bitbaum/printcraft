# PrintCraft — Web app

Composition editor for PrintCraft projects: upload figures, segment/style them,
and arrange them onto print-surface panels. Built with Next.js (App Router) and
a self-hosted Supabase stack.

## Getting started

```bash
pnpm install
cp .env.local.example .env.local   # fill in Supabase keys + AI provider tokens
pnpm run dev
```

Open http://localhost:3000.

## Infrastructure

- **Database & storage:** self-hosted Supabase on the Hetzner box
  (`supabase.orangecat.ch`), dedicated `printcraft` schema.
- **Accounts:** `@bitbaum/accountkit` on its own screens: `/login` (password,
  passkey, an emailed sign-in link, recovery, the second factor), `/register`
  and `/account`. "Continue with OrangeCat" and the shared sign-in show when
  their clients are set, the link and recovery when mail is. Its tables live
  in a host accounts database (`DATABASE_URL`, migrations in `drizzle/`; loki
  `accounts-db.conf`), beside the Supabase schema, which keeps the project
  data. API routes read that data with the service-role client and check
  ownership (`src/lib/api/ownership.ts`) against the session's user id.
- **People from before AccountKit** signed in through OrangeCat's GoTrue.
  `scripts/db/accountkit-import.sql` (repository root; run by loki
  `accountkit-supabase.yml`) gave each project owner an account under the same
  id, linked to OrangeCat by their actor id (never by address); they sign in
  with "Continue with OrangeCat" and find their projects.
- **Hosting:** self-hosted behind Caddy at `printcraft.orangecat.ch`.

See `AGENTS.md` for the data model and architecture, and the repository root
`README.md` for the generation pipeline and project layout.
