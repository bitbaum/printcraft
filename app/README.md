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
- **Hosting:** self-hosted behind Caddy at `printcraft.orangecat.ch`.

See `CLAUDE.md` for the data model and architecture, and the repository root
`README.md` for the generation pipeline and project layout.
