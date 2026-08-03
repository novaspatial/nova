# NovaSpatial — domain glossary

NovaSpatial is a Dolby Atmos mixing studio. This file is the project's ubiquitous language — what terms *mean* and the business values behind them — covering the **client portal** (commissioning, review, delivery) plus the public marketing site and blog. Implementation lives in `ARCHITECTURE.md`. Use these exact terms.

## People

**Client** — a customer who commissions a mix and owns one or more Projects: uploads stems, reviews mixes, leaves comments, downloads deliverables. *Avoid*: customer, buyer, user (a "user" is the auth account; "Client" is the role).

**Studio** — a NovaSpatial staff member: sees every Project, uploads, approves, and delivers mixes, and authors blog posts. *Avoid*: admin, engineer, staff.

## Projects & lifecycle

**Project** — a single mixing engagement for one Client; the root that owns all of an engagement's files, comments, and deliverables. *Avoid*: job, order, session, mix (a Project *contains* mixes; it is not one).

**Format** — the target listening format commissioned: Dolby Atmos (`atmos`), `binaural`, or `both`.

**Status** — where a Project sits in its lifecycle. The ordered states:

- **pending_payment** — created, awaiting payment before any work can start.
- **uploading** — paid; the Client is handing over stems.
- **in_review** — upload finished; the Studio is reviewing the source material.
- **mixing** — the Studio is actively mixing (`processing` is a legacy synonym; both display as "Mixing").
- **review** — a Mix is available to listen to and comment on; shown to Clients as **"Mix Available"**.
- **revision** — the Client asked for changes; the Studio is revising.
- **approved** — the final Mix is signed off; deliverables are being prepared.
- **delivered** — deliverables are downloadable. Delivery starts the retention clock (see Purge).

**Upload step / Listen step** — the two halves of the portal a Project passes through: Upload spans `pending_payment`→`mixing`, Listen spans `review`→`delivered`.

**Archive** — a Studio-only, reversible action that hides a finished Project from the studio dashboard; invisible to the Client. *Avoid*: delete (archiving never removes data).

**Purge** — the scheduled removal of a Project's stem and mix audio **90 days after delivery**, leaving a purged marker on the Project. The Project itself — the order, consent, and tax record — is kept forever; master references and comment attachments are never purged. *Avoid*: delete (the Project survives), expiry.

## Commerce & pricing

**Order** — the commercial half of a Project, frozen at checkout: song count, stem count, subtotal, add-ons, applied discount code, tax, billing region, reference tracks, and terms consent. Not a separate artifact — it lives on the Project and never changes after payment. *Avoid*: cart, invoice; and don't call the Project itself an "order" (the Project is the engagement; the Order is its frozen commercial terms).

**Quote** (price breakdown) — the itemized price of an Order: list price, bulk or code discount, add-ons, tax, total. One shared function computes it everywhere it appears (ARCHITECTURE §Payments), so a quote shown is the amount charged. The homepage calculator deep-links its quote into the order form.

**List price** — **$325 USD per song**; pricing is per-song, in USD.

**Bulk discount** — the automatic tier by song count: 3–4 songs 15%, 5–7 songs 20%, 8+ songs 25%. Applies on its own; a private discount code suppresses it.

**Discount code** — a code entered at checkout for money off, from a Studio-managed catalog; public or private, percent or fixed. Percent discounts stack with the bulk tier under a **35% cap**, and every discount respects the **$225-per-song floor** unless the code was created with permission to go below it. A code's capacity is **held** while a checkout is pending (returned if the pending Project is deleted) and **consumed** when the Order is paid — single-use codes really are single-use. *Avoid*: coupon in prose (some column and constant names say "coupon"; the spoken term is discount code), voucher, promo.

**Welcome discount** — the advertised first-order offer: **15%**, redeemed as the `WELCOME` code, eligible when the Client has no prior paid Project. Shown to Clients as "Welcome discount". *Avoid*: first-mix discount (the legacy profile flag behind the same offer, kept only as a no-code fallback), "50% off" (the dead launch promo it replaced).

**Add-on** — an optional extra bought with the Order: **extra revision round +$50**, **48-hour rush +$149**. Priced after discounts, outside the cap and floor, and taxed. Rush is always purchasable — there is no availability gate; extras wanted after the Order is paid are invoiced manually.

**Tax** — Canadian GST/HST on the discounted subtotal including add-ons, by billing province: full HST in HST provinces (15% NB/NL/PE, 14% NS, 13% ON), 5% GST elsewhere in Canada, non-Canadian buyers zero-rated.

**Terms consent** — the Client's recorded agreement to the Terms & Conditions at checkout (version + timestamp, frozen on the Order). A material T&C change bumps the terms version, forcing every new checkout to re-consent.

**Receipt** — the order-confirmation email sent to the Client exactly once when their Project becomes paid, restating the frozen Order.

## Files & audio

**Stem** — a Client-provided source track: one of the individual recordings (drums, vocals, synths…) the Studio mixes from. *Avoid*: track (overloaded — see Mix), source file.

**Master reference** (`master_ref`) — a Client-provided reference mixdown that guides the Studio's mix, handed over alongside stems.

**Mix** — a Studio-produced version of the Project's audio that the Client listens to and comments on; a Project may accumulate several across its revisions. *Avoid*: track (use "Mix" for the Studio version, "Stem" for Client source), version.

**Deliverable** — a final Mix the Client downloads from the Listen page after sign-off. A business term, not a separate artifact: the signed-off Mix files *are* the deliverables. *Avoid*: master, final, export.

## Review & comments

**Comment** — Client or Studio feedback anchored to a specific Mix: a point in time, a time range, or untimed; may carry attachments; may reply to another Comment. *Avoid*: note, annotation, feedback (generic).

**Comment clock** — the Listen-step interaction that captures the time range a Comment refers to as the reviewer types or plays the Mix. Its states: **off** (no timestamp will be attached) → **armed** (capture enabled, waiting to mark the start) → **live** (start set; the end tracks playback as it records the range) → **locked** (range finalized). *Avoid*: timer, scrubber, marker.

## Marketing & content

**Contact inquiry** — a message submitted through the public contact form.

**Blog post** — a Studio-authored article. No publish date = **draft**; once dated it is published and public.

**Hero image** — a post's first inline markdown image. By convention it *is* the hero: split off the body, rendered once at the top, and reused as the social/share fallback.

**Share image** — the auto-generated social card for a post (title, author, hero background), served per-post rather than hand-made.
