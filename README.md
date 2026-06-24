# NovaSpatial

World-Class Dolby Atmos Mixing Facility 

<img width="5916" height="3974" alt="NOVA_Studios_ATMOS-03" src="https://github.com/user-attachments/assets/05fd66d3-5d61-45ce-879c-1db3c8d5682f" />

## About

NovaSpatial is the marketing site, blog, and **client portal** for a Dolby Atmos mixing studio. Through the portal a client commissions a mix, uploads their stems, reviews the studio's mixes with timestamped comments, and downloads the finished deliverables.

Built with **Next.js 15** (App Router) and **React 19**, backed by **Supabase** (Postgres + Auth + Storage), **Stripe** for payments, and **Resend** for email. Deployed on **Vercel**.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

For local development without live payments, set `PAYMENTS_DEV_BYPASS=true` in `.env.local` — checkout then creates paid $0 projects and skips Stripe. **Never set this in production.**

### Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest (watch). Use `npx vitest run` for a single pass. |

### Environment

Configuration lives in `.env.local`; see `.env.example` for the full list. Supabase, Stripe, and Resend credentials are required for full functionality. `NEXT_PUBLIC_*` values are exposed to the browser; everything else is server-only.

## Project structure

```
src/
├── app/          # App Router: pages, API route handlers, server actions
├── components/   # React components (audio, portal, blog, sections, layout, ui)
├── hooks/        # Client hooks
├── lib/          # Domain + integrations (supabase, auth, stripe, portal, email, blog)
├── types/        # Shared types (portal.ts is the portal domain model)
└── middleware.ts # Auth guard for /portal and /profile
supabase/migrations/   # Schema, RLS policies, storage buckets (YYYYMMDD_*.sql)
```

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — how to work in this repo: commands, conventions, stack, testing, env, migrations.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — system structure, routing, auth/RLS, storage, payments, and the end-to-end data flow.
- **[CONTEXT.md](./CONTEXT.md)** — the domain glossary (ubiquitous language). Use these terms.
- **[docs/adr/](./docs/adr/)** — architecture decision records and their rationale.
- **[docs/devplan-issue-plan.md](./docs/devplan-issue-plan.md)** — the roadmap: a sequenced dev plan (commerce engine, SEO, lifecycle) sliced across the open GitHub issues. These are **planned, not yet built** — the docs above describe the current system.
