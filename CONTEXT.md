# NovaSpatial

NovaSpatial is a Dolby Atmos mixing studio. This context covers the **client portal** — where a Client commissions a mix, hands over source audio, reviews the Studio's mixes with timestamped feedback, and downloads the finished deliverables — plus the public marketing site and blog.

This file is a glossary of the project's ubiquitous language. It defines what terms *mean*, not how they're implemented (see `ARCHITECTURE.md` for that).

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
_Avoid_: job, order, session, mix (a Project *contains* mixes; it is not one).

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
- **delivered** — final deliverables are available for download.

**Upload step / Listen step**:
The two halves of the portal a Project passes through. The **Upload step** spans `pending_payment`→`mixing` (handing over source and mixing it). The **Listen step** spans `review`→`delivered` (reviewing and receiving the mix).

**Archive**:
A Studio-only action that hides a finished Project from the main dashboard. Reversible, and invisible to the Client.
_Avoid_: delete — archiving never removes data.

**First-mix discount**:
A one-time promotional price on a Client's first Project. Once consumed it cannot be used again.

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
A final, approved mix file the Client downloads. Distinct from a Mix: a Deliverable is the signed-off output in a specific delivery format.
_Avoid_: master, final, export.

**Delivery format**:
The technical format of a Deliverable: ADM Broadcast WAV for Dolby Atmos (`adm_bwf` / `dolby_atmos_adm`) or headphone stereo (`binaural_wav`). Unset until the Studio approves the Deliverable.

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

---

> **Forthcoming vocabulary (not yet built).** The planned commerce rework will introduce new terms — Order, discount code, add-on, welcome code, per-song list price, and tax. They are **not** part of the current ubiquitous language and are deliberately omitted above; they'll be defined here once built. See the roadmap in [`docs/devplan-issue-plan.md`](docs/devplan-issue-plan.md).
