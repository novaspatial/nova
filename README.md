# NovaSpatial

World-Class Dolby Atmos Mixing Facility

<img width="5916" height="3974" alt="NOVA_Studios_ATMOS-03" src="https://github.com/user-attachments/assets/05fd66d3-5d61-45ce-879c-1db3c8d5682f" />

## About

NovaSpatial is the marketing site, blog, and **client portal** for a Dolby Atmos mixing studio. Through the portal a Client commissions a mix at a priced checkout, uploads their stems, reviews the Studio's mixes with timestamped comments, and downloads the finished deliverables.

Built with **Next.js 15** (App Router), **React 19**, and **TypeScript** (strict), styled with **Tailwind CSS v4**, backed by **Supabase** (Postgres + Auth + Storage), **Stripe** for payments, and **Resend** for email. Deployed on **Vercel**.

### How it works

1. **Commission** — the Client picks songs, add-ons, and an optional discount code (the homepage price calculator deep-links its quote into the order form) and pays through Stripe. One shared pricing function quotes everywhere, so the quote shown is the amount charged — bulk tiers, discount codes, add-ons, and GST/HST included. The order is frozen on the Project at checkout, and a receipt email restates it once payment lands.
2. **Hand over** — stems and master references upload directly to Supabase Storage via signed URLs; large audio never streams through the API.
3. **Mix & review** — the Studio uploads Mixes; the Client plays them in the portal and leaves timestamped Comments (the comment clock), iterating through revisions. Status emails keep the Client posted.
4. **Deliver & purge** — after sign-off the final Mix files are the deliverables, downloaded via signed URLs. 90 days after delivery a daily cron purges the stem and mix audio; the Project survives as the order, consent, and tax record.

Authorization is **RLS-first**: Postgres Row Level Security in the migrations is the enforcement floor, with app-layer role checks as defense-in-depth. The blog ships per-post metadata and JSON-LD, generated share images, a sitemap, and IndexNow pings on publish.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see below)
npm run dev                  # http://localhost:3000
```

For local development without live payments, set `PAYMENTS_DEV_BYPASS=true` in `.env.local` — checkout then creates paid $0 projects and skips Stripe. It works **only off Vercel**: the code refuses the bypass on any Vercel deploy, preview as well as production, so a stray value in either env scope is inert (#45). Preview is included deliberately — there is one Supabase project and no branches, so a preview deploy writes to the production database. To smoke-test checkout on a deploy, use a [Stripe test card](https://docs.stripe.com/testing), which exercises more of the flow than the bypass does.

### Commands

| Command         | Description                                             |
| --------------- | ------------------------------------------------------- |
| `npm run dev`   | Start the dev server                                    |
| `npm run build` | Production build                                        |
| `npm start`     | Serve the production build                              |
| `npm run lint`  | ESLint                                                  |
| `npm test`      | Vitest (watch). Use `npx vitest run` for a single pass. |

Tests are co-located as `*.test.ts(x)` (72 files / ~860 tests); Supabase, Stripe, and DNS are mocked — no real network.

### Environment

Configuration lives in `.env.local`; see `.env.example` for the full list. Supabase, Stripe, and Resend credentials are required for full functionality; `NEXT_PUBLIC_SITE_URL`, `INDEXNOW_KEY`, and `CRON_SECRET` configure the canonical origin, IndexNow pings, and the purge cron. `NEXT_PUBLIC_*` values are exposed to the browser; everything else is server-only.

## Project structure

```
src/
├── app/          # App Router: pages, API route handlers, server actions
├── components/   # React components (audio, portal, blog, sections, layout, ui, popups)
├── hooks/        # Client hooks
├── lib/          # Domain + integrations (supabase, auth, stripe, portal, email, blog, legal)
├── types/        # Shared types (portal.ts is the portal domain model)
├── styles/       # Tailwind v4 entry + theme tokens + typography
└── middleware.ts # Auth guard for /portal, /profile, and /blog/admin
supabase/migrations/   # Schema, RLS policies, storage buckets (YYYYMMDD_*.sql)
```

## Deploy

Vercel. CI (`.github/workflows/main.yml`) runs lint → tests → build on every push and PR to `main`. `vercel.json` schedules the one cron, `/api/cron/purge-delivered` (daily, 06:00 UTC). Migrations are applied via the Supabase CLI — not in CI.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — how to work in this repo: commands, conventions, stack, testing, env, migrations.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — system structure, routing, auth/RLS, storage, payments, email, blog/SEO, and the end-to-end data flow.
- **[CONTEXT.md](./CONTEXT.md)** — the domain glossary (ubiquitous language). Use these terms.
