# 1. Studio access is granted out of band, through a service context only

Date: 2026-07-31
Status: Accepted

## Context

`profiles.role` is the hinge the whole authorization model turns on. Ten RLS
policies, `requireApiStudioUser`, and every `enforce_*` fence's studio escape all
read it, so `role = 'studio'` is effectively "can see and change everything".

Until 2026-07-30 nothing stopped a client from setting it on themselves: the only
UPDATE policy on `profiles` was `USING (auth.uid() = id)` with no `WITH CHECK` and
no column list, so `PATCH /rest/v1/profiles {"role":"studio"}` through PostgREST
was a complete privilege escalation (#44). That is closed, but closing it left an
unwritten question: if no client can grant the role, **who can, and how?**

Nothing in the repo answered it. No app code writes `role` — the three
`from('profiles')` sites are one profile-form update of `display_name`/`avatar_url`
and two reads — and `handle_new_user` inserts a row without touching `role`, so it
takes the `'client'` default. `profiles` has no INSERT policy at all, so a row
cannot be born studio from a session either. Every studio account that exists was
therefore created out of band, and the procedure lived only in whoever did it.

## Decision

**Studio access is granted manually, from a service context, and never from an
application surface.** In practice that means the Supabase SQL editor or a script
holding `SUPABASE_SERVICE_ROLE_KEY`:

```sql
update public.profiles set role = 'studio' where email = '<the account>';
-- revoke the same way
update public.profiles set role = 'client' where email = '<the account>';
```

No admin UI, no API route, no invite flow. The population is a handful of studio
engineers; a self-serve promotion path would be more attack surface than
convenience.

Two independent layers enforce this, and it is worth being precise about which
one actually binds, because #44's own closing note got it slightly wrong:

1. **Grants.** The blanket table UPDATE was revoked from `authenticated`/`anon`
   and re-granted per column: `GRANT UPDATE (display_name, avatar_url, updated_at)`.
   `authenticated` is the Postgres role a *studio* user browses with too, so this
   layer refuses a `role` write from any PostgREST session, studio or not — the
   error is `permission denied for table profiles`.
2. **The fence.** `profiles_enforce_privileged_columns`, a `BEFORE UPDATE OF role,
   first_mix_discount, email` `SECURITY DEFINER` trigger, raises `42501` unless the
   caller is a service context (`auth.uid() IS NULL`) or a studio profile.

So the trigger's studio branch is unreachable through the normal API: layer 1
refuses the statement before the trigger ever runs. It survives as the floor for
anything that reaches the table another way — a future `postgres`-role tool, or a
regrant that widens layer 1 by accident. **The only working promotion path today
is service-role.**

The proposal in #44's body — a column-level `REVOKE UPDATE (role,
first_mix_discount)` — was a no-op against Supabase's table-level grant, because
column privileges were never granted separately. Grant narrowing is the equivalent
that actually bites. Don't "restore" the original.

## Consequences

- Granting studio access requires Supabase project access. That is the intended
  bar, and it means the set of people who can create a studio account is the set
  who can already read the database.
- There is no audit trail on the promotion itself beyond Supabase's own logs. At
  this population size that is accepted; if studio accounts ever outgrow a handful,
  the right fix is a promotion RPC that writes an audit row, not an admin UI.
- `email` is frozen by the same fence, deliberately beyond #44's ask: no session
  writes it, and it is where receipts and status mail are sent.
- `is_studio()` (added with the fence, because a policy on `profiles` cannot
  subquery `profiles` without recursing with `42P17`) is now shared infrastructure
  — the #47 read policy uses it too. Changing its semantics silently changes
  profile visibility.

## Audit, 2026-07-31

Production held exactly two `role = 'studio'` profiles at the time of writing —
"Admin" (created 2026-03-02) and "jamiekuse" (created 2026-05-06, matching the
studio engineer of that name in `src/lib/team.ts`). Both were confirmed by the
owner as intended accounts, which closes the question the escalation window
(table creation on 2026-02-19 until the fence on 2026-07-30) left open.
