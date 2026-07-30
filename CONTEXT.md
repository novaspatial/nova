# NovaSpatial

NovaSpatial is a Dolby Atmos mixing studio. This context covers the **client portal** — where a Client commissions a mix, hands over source audio, reviews the Studio's mixes with timestamped feedback, and downloads the finished deliverables — plus the public marketing site and blog.

This file is a glossary of the project's ubiquitous language. It defines what terms _mean_, not how they're implemented (see `ARCHITECTURE.md` for that).

## Language

### People

**Client**:
A customer who commissions a mix and owns one or more Projects. Uploads stems, reviews mixes, leaves comments, and downloads deliverables.
_Avoid_: customer, buyer, user (a "user" is the auth account; "Client" is the role).

**Studio**:
A NovaSpatial staff member. Sees every Project, uploads mixes, approves and delivers them, and authors blog posts.
_Avoid_: admin, engineer, staff (pick "Studio" for the role).

### Projects & lifecycle

**Project**:
A single mixing engagement for one Client. The root that owns all of an engagement's files, comments, and deliverables.
_Avoid_: job, order, session, mix (a Project _contains_ mixes; it is not one).

**Format** (of a Project):
The target listening format the Client commissions: Dolby Atmos (`atmos`), `binaural`, or `both`.

**Status**:
Where a Project sits in its lifecycle. The ordered states:

- **pending_payment** — created, awaiting payment before any work can start.
- **uploading** — paid; the Client is handing over stems.
- **in_review** — the Client has finished uploading; the Studio is reviewing the source material.
- **mixing** — the Studio is actively mixing. (`processing` is an older synonym for the same phase; both display as "Mixing".)
- **review** — a Mix is available for the Client to listen to and comment on. Shown to clients as **"Mix Available"**.
- **revision** — the Client asked for changes; the Studio is revising.
- **approved** — the final Mix is signed off; deliverables are being prepared.
- **delivered** — final deliverables are available for download. Delivery also starts the 90-day retention clock (see **Purge**).

**Upload step / Listen step**:
The two halves of the portal a Project passes through. The **Upload step** spans `pending_payment`→`mixing` (handing over source and mixing it). The **Listen step** spans `review`→`delivered` (reviewing and receiving the mix).

**Archive**:
A Studio-only action that hides a finished Project from the main dashboard. Reversible, and invisible to the Client.
_Avoid_: delete — archiving never removes data.

**Purge**:
The scheduled removal of a Project's stem and mix audio 90 days after delivery, leaving a purged marker on the Project. The Project itself — the order, consent, and tax record — is kept forever; master references and comment attachments are not purged.
_Avoid_: delete (the Project survives), expiry.

### Commerce & pricing

**Order**:
The commercial half of a Project, frozen at checkout: song count, stem count, add-ons, applied discount code, tax, billing region, and terms consent. Not a separate artifact — it lives on the Project and never changes after payment.
_Avoid_: cart, invoice; and don't call the Project itself an "order" (the Project is the engagement; the Order is its frozen commercial terms).

**Quote** (or price breakdown):
The itemized price of an Order — list price, bulk or code discount, add-ons, tax, total. Computed by one shared function everywhere it appears (homepage price calculator, order form, payment step, charge), so a quote shown is the amount charged. The calculator deep-links its quote into the order form.

**List price**:
$325 USD per song — pricing is per-song, in USD.

**Bulk discount**:
The automatic tier by song count: 3–4 songs 15%, 5–7 songs 20%, 8+ songs 25%. Applies on its own; a private discount code suppresses it.

**Discount code**:
A code entered at checkout for money off, drawn from a Studio-managed catalog. Public or private; percent or fixed amount. Percent discounts stack with the bulk tier under a 35% cap; every discount respects the $225-per-song floor unless the code was created with permission to go below it. A code's capacity is **held** while a checkout is pending (returned if the pending Project is deleted) and **consumed** when the Order is paid — single-use codes really are single-use.
_Avoid_: coupon in prose (some column/constant names say "coupon"; the spoken term is discount code), voucher, promo.

**Welcome discount**:
The advertised first-order offer — 15%, redeemed as the `WELCOME` code at checkout. Eligibility: the Client has no prior paid Project. Displayed to Clients as "Welcome discount".
_Avoid_: first-mix discount (the legacy profile flag behind the same offer, kept only as a no-code fallback), "50% off" (the dead launch promo it replaced).

**Add-on**:
An optional extra purchased with the Order: **Extra revision round** (+$50) and **48-hour rush** (+$149). Priced after discounts, outside the cap and floor, and taxed. Rush is always purchasable — there is no availability gate; extras wanted after the Order is paid are invoiced manually.

**Tax**:
Canadian GST/HST on the discounted subtotal including add-ons, by billing province — full HST in HST provinces, 5% GST elsewhere in Canada; non-Canadian buyers are zero-rated.

**Terms consent**:
The Client's recorded agreement to the Terms & Conditions at checkout (version + timestamp, frozen on the Order). A material change to the T&C bumps the terms version, which forces every new checkout to re-consent.

**Receipt**:
The order-confirmation email sent to the Client exactly once when their Project becomes paid, restating the frozen Order.

### Files & audio

**Stem**:
A Client-provided source track — one of the individual recordings (e.g. drums, vocals, synths) the Studio mixes from.
_Avoid_: track (overloaded — see Mix), source file.

**Master reference** (`master_ref`):
A Client-provided reference mixdown that guides the Studio's mix, handed over alongside stems.

**Mix**:
A Studio-produced version of the Project's audio that the Client listens to and comments on. A Project may accumulate several across its revisions.
_Avoid_: track (use "Mix" for the Studio version; reserve "Stem" for Client source), version.

**Deliverable**:
A final Mix the Client downloads from the Listen page after sign-off. A business term, not a separate artifact: the signed-off Mix files _are_ the deliverables (the dormant `deliverables` table was removed in `20260725`).
_Avoid_: master, final, export.

### Review & comments

**Comment**:
A piece of Client or Studio feedback anchored to a specific Mix. May mark a point in time, a time range, or be untimed; may carry file attachments; may reply to another Comment.
_Avoid_: note, annotation, feedback (generic).

**Comment clock**:
The Listen-step interaction that captures the time range a Comment refers to as the reviewer types or plays the Mix. Its states:

- **off** — no timestamp will be attached.
- **armed** — capture is enabled, waiting to mark the start.
- **live** — the start is set and the end tracks playback as it records the range.
- **locked** — the range is finalized.

_Avoid_: timer, scrubber, marker.

### Marketing & content

**Contact inquiry**:
A message submitted through the public contact form.

**Blog post**:
A Studio-authored article. A post with no publish date is a **draft**; once it has one it is published and public.

**Hero image**:
A post's first inline markdown image. By convention it _is_ the hero — split off the body, rendered once at the top, and reused as the social/share fallback.

**Share image**:
The auto-generated social card for a post (title, author, hero background), served per-post rather than hand-made.
