# PROJECT_ARCHITECTURE.md

> Comprehensive technical documentation for the **Nova** project — a Dolby Atmos mixing studio website built with Next.js 15.

---

## Project Overview

| Property                | Value                                                |
| ----------------------- | ---------------------------------------------------- |
| **Next.js Version**     | `^15.5.10` (App Router)                              |
| **Language**            | TypeScript `^5.8.3` (strict mode)                    |
| **Package Manager**     | npm (lockfileVersion 3, `package-lock.json` present) |
| **Node.js Constraints** | None (no `.nvmrc` or `engines` field)                |
| **Browserslist**        | `defaults, not ie <= 11`                             |
| **Project Name**        | `tailwind-plus-studio` (in package.json)             |

### Dependencies by Purpose

#### Framework & Core

| Package      | Version    |
| ------------ | ---------- |
| `next`       | `^15.5.10` |
| `react`      | `^19.2.4`  |
| `react-dom`  | `^19.2.4`  |
| `typescript` | `^5.8.3`   |

#### Styling

| Package                | Version   |
| ---------------------- | --------- |
| `tailwindcss`          | `^4.1.15` |
| `@tailwindcss/postcss` | `^4.1.15` |

#### UI Components

| Package             | Version  |
| ------------------- | -------- |
| `@headlessui/react` | `^2.2.9` |
| `@heroicons/react`  | `^2.2.0` |
| `clsx`              | `^2.1.1` |

#### Animation

| Package         | Version     |
| --------------- | ----------- |
| `framer-motion` | `^12.23.11` |

#### Database & Auth (Supabase)

| Package                 | Version   |
| ----------------------- | --------- |
| `@supabase/supabase-js` | `^2.97.0` |
| `@supabase/ssr`         | `^0.8.0`  |

#### MDX / Content

| Package                | Version   |
| ---------------------- | --------- |
| `@next/mdx`            | `^15`     |
| `@mdx-js/loader`       | `^3.1.0`  |
| `@mdx-js/react`        | `^3.1.0`  |
| `@types/mdx`           | `^2.0.13` |
| `remark-gfm`           | `^4.0.1`  |
| `remark-rehype-wrap`   | `0.0.5`   |
| `rehype-unwrap-images` | `^1.0.0`  |
| `@leafac/rehype-shiki` | `^2.2.1`  |
| `shiki`                | `^0.11.1` |
| `recma-import-images`  | `0.0.3`   |
| `unified-conditional`  | `0.0.2`   |

#### Utilities

| Package                | Version   |
| ---------------------- | --------- |
| `acorn`                | `^8.15.0` |
| `acorn-jsx`            | `^5.3.2`  |
| `escape-string-regexp` | `^5.0.0`  |
| `fast-glob`            | `^3.3.3`  |

#### devDependencies

| Package                       | Version   | Purpose                |
| ----------------------------- | --------- | ---------------------- |
| `@types/node`                 | `^24.1.0` | Node.js types          |
| `@types/react`                | `^19`     | React types            |
| `@types/react-dom`            | `^19`     | React DOM types        |
| `eslint`                      | `^9.32.0` | Linting                |
| `eslint-config-next`          | `^15`     | Next.js ESLint rules   |
| `prettier`                    | `^3.6.2`  | Code formatting        |
| `prettier-plugin-tailwindcss` | `^0.7.1`  | Tailwind class sorting |
| `sharp`                       | `0.34.3`  | Image optimization     |

---

### Naming Conventions

| Type              | Convention                                   | Example                             |
| ----------------- | -------------------------------------------- | ----------------------------------- |
| Components        | PascalCase `.tsx`                            | `Button.tsx`, `RootLayout.tsx`      |
| Utilities         | camelCase `.ts`                              | `formatDate.ts`, `mdx.ts`           |
| Pages             | `page.tsx` / `page.mdx` (Next.js convention) | `src/app/about/page.tsx`            |
| API Routes        | `route.ts` (Next.js convention)              | `src/app/auth/callback/route.ts`    |
| Route directories | kebab-case                                   | `a-short-guide-to-component-naming` |
| CSS files         | kebab-case `.css`                            | `tailwind.css`, `typography.css`    |

### Barrel Exports

**None.** All components are imported directly:

```typescript
import { Button } from '@/components/Button'
```

---

## Routing Structure

### Pages

| Route          | File                       | Type                   | Description                                    |
| -------------- | -------------------------- | ---------------------- | ---------------------------------------------- |
| `/`            | `src/app/page.tsx`         | Static                 | Homepage with hero, clients, testimonials, FAQ |
| `/about`       | `src/app/about/page.tsx`   | Async (loads articles) | Company info, team, blog links                 |
| `/blog`        | `src/app/blog/page.tsx`    | Async (loads articles) | Blog article listing                           |
| `/blog/[slug]` | `src/app/blog/*/page.mdx`  | Static (MDX)           | Individual blog articles                       |
| `/contact`     | `src/app/contact/page.tsx` | Static                 | Contact form + office locations                |
| `/login`       | `src/app/login/page.tsx`   | Static (client)        | Login/signup page                              |
| `/profile`     | `src/app/profile/page.tsx` | Async (auth check)     | User profile (protected)                       |

### API Routes

| Path             | Method | Auth? | Description                                               |
| ---------------- | ------ | ----- | --------------------------------------------------------- |
| `/auth/callback` | `GET`  | No    | OAuth callback — exchanges auth code for Supabase session |

### Middleware

- **Location:** `src/middleware.ts`
- **Intercepts:** All requests except static assets (`_next/static`, `_next/image`, `favicon.ico`, images, videos)
- **Logic:**
  1. Creates Supabase server client with cookie management
  2. Validates JWT claims via `supabase.auth.getClaims()`
  3. Redirects unauthenticated users from `/profile` → `/login`
  4. Redirects authenticated users from `/login` → `/`
  5. Refreshes session cookies on every request

### next.config.mjs Settings

- **Page extensions:** `js`, `jsx`, `ts`, `tsx`, `mdx`
- **Custom headers:** Aggressive caching for `/videos/*` and `/images/*` (`max-age=31536000, immutable`)
- **MDX pipeline:** Remark (GFM, conditional layout), Rehype (Shiki syntax highlighting, image unwrapping, typography wrapping), Recma (image imports)
- **No rewrites or redirects configured**

---

### Custom Hooks

| Hook          | Location                    | Purpose                                                                                        |
| ------------- | --------------------------- | ---------------------------------------------------------------------------------------------- |
| `useAuthUser` | `RootLayout.tsx` (internal) | Manages Supabase auth state, subscribes to auth changes. Returns `{ user, loading, supabase }` |

### Context Providers

| Context                | Location     | Purpose                                                                                             |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| `FadeInStaggerContext` | `FadeIn.tsx` | Coordinates staggered animation timing between parent `FadeInStagger` and child `FadeIn` components |

---

## Styling & Design System

**Tailwind CSS v4** with the new `@tailwindcss/postcss` integration (no `tailwind.config.js` — configuration is done via `@theme` in CSS).

- **Global styles:** `src/styles/tailwind.css` (Tailwind imports + theme + keyframes)
- **Base styles:** `src/styles/base.css` (@font-face declaration)
- **Typography styles:** `src/styles/typography.css` (prose/MDX content styling)
- **No CSS Modules, no styled-components, no Sass**

### Primary Brand Colors (Violet/Purple/Indigo Gradient System)

| Color            | Value                           | Where Used                                                  | Purpose              |
| ---------------- | ------------------------------- | ----------------------------------------------------------- | -------------------- |
| Violet 300       | `#c4b5fd`                       | Nav highlight animation                                     | Highlight glow color |
| Violet 400       | `#a78bfa`                       | Active nav link, border animation, focus states, link hover | Active/focus accent  |
| Violet 500       | `#8b5cf6` (via rgba)            | Text shadows, glow effects, grid pattern fill               | Glow/ambient effects |
| Violet 500/10-20 | `rgba(139,92,246,0.1-0.2)`      | Shadow colors, avatar bg, badge bg                          | Subtle accents       |
| Violet 600       | `#7c3aed`                       | Login submit button, border animation, promo CTA            | Primary action       |
| Purple 500/10    | Tailwind `stroke-purple-500/10` | Grid pattern stroke                                         | Pattern lines        |
| Purple 900/80    | Tailwind `to-purple-900/80`     | Button gradient endpoint                                    | Gradient terminus    |
| Indigo 500-600   | `#6366f1` / `#4f46e5`           | Promo banner gradient start                                 | Gradient start       |
| Indigo 900/80    | Tailwind `from-indigo-900/80`   | Button gradient start                                       | Gradient start       |

#### Gradient Definitions

| Gradient         | Values                                                          | Where Used                                      |
| ---------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| Button primary   | `from-indigo-900/80 via-violet-800/80 to-purple-900/80`         | `Button.tsx`, timeline steps, newsletter submit |
| Button hover     | `from-indigo-950 via-violet-900 to-purple-950`                  | Button hover state                              |
| Promo CTA        | `from-indigo-600 via-violet-600 to-purple-600`                  | PromoPopup link                                 |
| Promo accent bar | `from-indigo-500 via-violet-500 to-purple-500`                  | PromoPopup top stripe                           |
| Border animation | `conic-gradient(... #a78bfa 78%, #c084fc 82%, #7c3aed 90% ...)` | Desktop nav, login card                         |
| Grid hovered     | `#131134 → #1c0b39 → #220b35 → #2c082e`                         | GridPattern hover blocks                        |
| Grid static      | `#1e1b4b → #2e1065 → #4a044e`                                   | GridPattern static blocks                       |

#### Neutral Colors

| Color       | Value                                    | Where Used                                | Purpose                |
| ----------- | ---------------------------------------- | ----------------------------------------- | ---------------------- |
| White       | `#fff` / `text-white`                    | Headings, buttons, labels                 | Primary text on dark   |
| White/70    | `text-white/70`                          | Footer links, newsletter text             | Secondary text         |
| White/50    | `placeholder:text-white/50`              | Input placeholders                        | Placeholder text       |
| White/10    | `ring-white/10`, `border-white/10`       | Borders, rings                            | Subtle borders         |
| White/5     | `bg-white/5`                             | Card backgrounds, inputs                  | Subtle backgrounds     |
| Zinc 100/5  | `divide-zinc-100/5`                      | Mobile nav dividers                       | Divider lines          |
| Zinc 200    | `text-zinc-200`                          | Nav text, user names                      | Body text              |
| Zinc 300    | `text-zinc-300`                          | Menu items, secondary labels              | Tertiary text          |
| Zinc 400    | `text-zinc-400`                          | Descriptions, input labels, icons         | Muted text             |
| Zinc 500    | `text-zinc-500` / `placeholder-zinc-500` | Placeholders, fine print                  | Very muted text        |
| Zinc 800    | `bg-zinc-800` / `bg-zinc-800/90`         | Nav pill, skeleton loader                 | Surface backgrounds    |
| Zinc 900    | `bg-zinc-900`                            | Mobile nav panel, login card, dropdown    | Card backgrounds       |
| Zinc 900/95 | `bg-zinc-900/95`                         | Promo popup                               | Semi-transparent cards |
| Zinc 950    | `bg-zinc-950`                            | Page background, body                     | Page background        |
| Neutral 300 | `text-neutral-300`                       | Typography body, testimonial text, labels | Typography body        |
| Neutral 400 | `text-neutral-400`                       | Subtitles, descriptions                   | Subdued text           |
| Neutral 500 | `text-neutral-500`                       | Trust badges, list markers                | Very muted text        |
| Neutral 950 | `bg-neutral-950`                         | HTML body background                      | Root background        |

#### Semantic Colors

| Color             | Value                                        | Where Used           | Purpose            |
| ----------------- | -------------------------------------------- | -------------------- | ------------------ |
| Red 300           | `text-red-300`                               | Error message text   | Error text         |
| Red 500/10-20     | `bg-red-500/10`, `border-red-500/20`         | Error container      | Error background   |
| Emerald 300       | `text-emerald-300`                           | Success message text | Success text       |
| Emerald 500/10-20 | `bg-emerald-500/10`, `border-emerald-500/20` | Success container    | Success background |

#### Fonts

| Font                     | Source                                  | Weight Range | Usage                                             |
| ------------------------ | --------------------------------------- | ------------ | ------------------------------------------------- |
| **Mona Sans** (variable) | Local (`src/fonts/Mona-Sans.var.woff2`) | 200–900      | Primary font (`--font-sans` and `--font-display`) |

Font loaded via `@font-face` in `base.css` with `font-display: block` and `font-stretch: 75%–125%`. The display font uses `font-variation-settings: 'wdth' 125` for wider tracking.

#### Font Sizes (from `@theme` in `tailwind.css`)

| Token       | Size              | Line Height      |
| ----------- | ----------------- | ---------------- |
| `text-xs`   | `0.75rem` (12px)  | `1rem` (16px)    |
| `text-sm`   | `0.875rem` (14px) | `1.5rem` (24px)  |
| `text-base` | `1rem` (16px)     | `1.75rem` (28px) |
| `text-lg`   | `1.125rem` (18px) | `1.75rem` (28px) |
| `text-xl`   | `1.25rem` (20px)  | `2rem` (32px)    |
| `text-2xl`  | `1.5rem` (24px)   | `2.25rem` (36px) |
| `text-3xl`  | `1.75rem` (28px)  | `2.25rem` (36px) |
| `text-4xl`  | `2rem` (32px)     | `2.5rem` (40px)  |
| `text-5xl`  | `2.5rem` (40px)   | `3rem` (48px)    |
| `text-6xl`  | `3rem` (48px)     | `3.5rem` (56px)  |
| `text-7xl`  | `4rem` (64px)     | `4.5rem` (72px)  |
| `text-8xl`  | `6rem` (96px)     | `1` (unitless)   |
| `text-9xl`  | `8rem` (128px)    | `1` (unitless)   |

Additional inline sizes: `text-[10px]` (Footer small text), `text-[11px]` (PromoPopup fine print).

#### Font Weights Used

- `font-medium` — Nav links, stat labels
- `font-semibold` — Section titles, typography headings, badges
- `font-bold` — Buttons, hero text, login headings

### Spacing & Layout

- **Spacing scale:** Tailwind v4 default spacing (0.25rem increments)
- **Custom radius:** `--radius-4xl: 2.5rem` (40px)
- **Container:** Uses `Container` component with `mx-auto max-w-7xl px-6 lg:px-8`
- **Layout patterns:** Flexbox (navigation, cards), CSS Grid (footer, highlights, testimonials), CSS columns (testimonials 2-3 col)

### Responsive / Mobile-Friendly CSS

#### Breakpoints

| Breakpoint     | Value              | Source                     |
| -------------- | ------------------ | -------------------------- |
| `sm`           | `640px`            | Tailwind v4 default        |
| `md`           | `768px`            | Tailwind v4 default        |
| `lg`           | `1024px`           | Tailwind v4 default        |
| `xl`           | `1280px`           | Tailwind v4 default        |
| `2xl`          | `1536px`           | Tailwind v4 default        |
| `3xl`          | `87.5rem` (1400px) | Custom in `@theme`         |
| `min-[1400px]` | `1400px`           | Arbitrary value (UserMenu) |

#### Custom Breakpoint Usage

The `3xl` breakpoint is used extensively throughout the project for large displays:

- Hero spacing: `3xl:mt-56`
- Typography scaling: `3xl:text-lg`, `3xl:text-6xl`
- Component sizing: `3xl:h-18`, `3xl:size-20`

#### Responsive Patterns

- **Mobile navigation:** `md:hidden` Popover (hamburger) vs `hidden md:flex` DesktopNavigation
- **Logo:** `Logomark` on mobile (`sm:hidden`), full `Logo` on desktop (`hidden sm:block`)
- **Testimonials grid:** 1 column → `sm:columns-2` → `lg:columns-3`
- **Timeline:** Stacked cards on mobile, alternating left/right on `lg:`
- **Footer text:** `text-[10px]` on mobile → `sm:text-sm` → `3xl:text-base`

---

## State Management

### Approach: React State + Supabase Auth

No external state management library (no Redux, Zustand, Jotai, etc.). State is managed via:

| Method                | Usage                                                   |
| --------------------- | ------------------------------------------------------- |
| `useState`            | Local component state (forms, toggles, expanded states) |
| `useEffect`           | Auth subscription, timers, mouse tracking               |
| `React.createContext` | `FadeInStaggerContext` for animation coordination       |
| Supabase Auth SDK     | User session state, auth listeners                      |
| `sessionStorage`      | PromoPopup dismiss state                                |

### Data Flow

```
Server (Supabase DB)
  ↓ Server Components (profile/page.tsx, about/page.tsx)
  ↓ createClient() from @supabase/ssr
  ↓ Props passed to Client Components
  ↓
Client Components
  ↓ useAuthUser() hook → Supabase browser client
  ↓ onAuthStateChange subscription
  ↓ Local useState for UI state
```

---

## 7. Backend / API Layer

### 7.1 API Routes

| Path             | Method | Auth? | Request                        | Response       | Description                                                        |
| ---------------- | ------ | ----- | ------------------------------ | -------------- | ------------------------------------------------------------------ |
| `/auth/callback` | `GET`  | No    | `?code=<string>&next=<string>` | `302 Redirect` | Exchanges OAuth code for session, redirects to `next` param or `/` |

### 7.2 Server Components & Server Actions

**No server actions** are used. Data fetching uses async server components:

| Component          | Data Fetching                                           | Pattern                                             |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------- |
| `about/page.tsx`   | `loadArticles()`                                        | Async server component, dynamic import of MDX files |
| `blog/page.tsx`    | `loadArticles()`                                        | Same as above                                       |
| `blog/wrapper.tsx` | `loadArticles()`                                        | Same, for related articles                          |
| `profile/page.tsx` | `supabase.auth.getUser()` + `supabase.from('profiles')` | Server-side Supabase query                          |

**No ISR, no `getServerSideProps`, no `getStaticProps`** (pure App Router).

### 7.3 Database & ORM

| Property             | Value                                                                         |
| -------------------- | ----------------------------------------------------------------------------- |
| **Database**         | PostgreSQL (via Supabase)                                                     |
| **ORM/Client**       | Supabase JS SDK (`@supabase/supabase-js`)                                     |
| **Connection Setup** | `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (server) |

#### Schema: `public.profiles`

| Column               | Type          | Constraints                     |
| -------------------- | ------------- | ------------------------------- |
| `id`                 | `uuid`        | PK, FK → `auth.users` (CASCADE) |
| `email`              | `text`        |                                 |
| `display_name`       | `text`        |                                 |
| `avatar_url`         | `text`        |                                 |
| `first_mix_discount` | `boolean`     | NOT NULL, DEFAULT `false`       |
| `created_at`         | `timestamptz` | DEFAULT `now()`                 |
| `updated_at`         | `timestamptz` | DEFAULT `now()`                 |

#### Row Level Security (RLS)

| Policy                                     | Operation | Rule                 |
| ------------------------------------------ | --------- | -------------------- |
| "Public profiles are viewable by everyone" | SELECT    | `true` (public read) |
| "Users can update their own profile"       | UPDATE    | `auth.uid() = id`    |

#### Trigger

- `on_auth_user_created`: After INSERT on `auth.users` → auto-creates `profiles` row with email, display_name (from metadata or email prefix), avatar_url

### 7.4 Authentication

| Property             | Value                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| **Solution**         | Supabase Auth (`@supabase/ssr`)                                                                                  |
| **Providers**        | Email/Password (active), Google OAuth (code present, not configured), Apple OAuth (code present, not configured) |
| **Session Strategy** | Cookie-based (managed by `@supabase/ssr`)                                                                        |
| **JWT Validation**   | `supabase.auth.getClaims()` in middleware                                                                        |
| **Protected Routes** | `/profile` (redirects to `/login` if unauthenticated)                                                            |
| **Login Redirect**   | Authenticated users visiting `/login` are redirected to `/`                                                      |

### 7.5 External Services & APIs

| Service      | Purpose                                      |
| ------------ | -------------------------------------------- |
| **Supabase** | Database, authentication, row-level security |

#### Environment Variables

| Variable                               | Scope           | Purpose                  |
| -------------------------------------- | --------------- | ------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`             | Client + Server | Supabase project URL     |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client + Server | Supabase anon/public key |

Both are `NEXT_PUBLIC_` prefixed (client-exposed). No server-only env vars configured.

---

## 8. Configuration Files

### `next.config.mjs`

```javascript
const nextConfig = {
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'mdx'],
  async headers() {
    // Cache /videos/* and /images/* for 1 year (immutable)
  },
}
// + MDX pipeline with Shiki, Remark GFM, Rehype, custom layout wrapper
```

### `tsconfig.json`

| Setting            | Value             |
| ------------------ | ----------------- |
| `target`           | `es6`             |
| `strict`           | `true`            |
| `module`           | `esnext`          |
| `moduleResolution` | `bundler`         |
| `jsx`              | `preserve`        |
| `incremental`      | `true`            |
| `paths`            | `@/*` → `./src/*` |

### `postcss.config.js`

```javascript
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {}, // Tailwind CSS v4
  },
}
```

### `prettier.config.js`

| Setting              | Value                         |
| -------------------- | ----------------------------- |
| `singleQuote`        | `true`                        |
| `semi`               | `false`                       |
| `plugins`            | `prettier-plugin-tailwindcss` |
| `tailwindStylesheet` | `./src/styles/tailwind.css`   |

### ESLint

No explicit `.eslintrc` file. Uses `eslint-config-next` via the `eslint` and `eslint-config-next` devDependencies. Run with `next lint` script.

---

## 9. Performance & Optimization

### Image Optimization

- **`next/image` usage:** Used in `GrayscaleTransitionImage.tsx`, `StylizedImage.tsx`, blog wrapper, about page (team photos), and WorkClients
- **Raw `<img>` tags:** Used in `Testimonials.tsx` (testimonial avatars), `RootLayout.tsx` (user avatars) — these bypass Next.js image optimization
- **`sharp`** installed as devDependency for Next.js image optimization
- **Large unoptimized images:** `nova.png` (12.2 MB), `mix.png` (10.6 MB), `composition.png` (2.1 MB) — these are in `src/images/` and imported via `next/image` through MDX

### Code Splitting

- **Dynamic import:** `VideoBackground` is dynamically imported in `RootLayout.tsx` with `{ ssr: false }` and a loading skeleton
- **No other explicit `dynamic()` or `React.lazy()` calls**
- **Next.js automatic code splitting** applies per-route

### Caching

- Static assets (`/videos/*`, `/images/*`): `Cache-Control: public, max-age=31536000, immutable`
- No explicit `revalidate` values on any routes
- No ISR configured

### Fonts

- **Mona Sans** variable font loaded via `@font-face` with `font-display: block`
- Not using `next/font` (could be optimized to use it for better loading)

### Custom Animations (6 keyframe animations)

| Animation          | Duration                | Purpose                               |
| ------------------ | ----------------------- | ------------------------------------- |
| `marquee`          | 40s linear infinite     | Client logos scroll                   |
| `border-flow`      | 4s linear infinite      | Rotating border gradient (nav, login) |
| `nav-highlight`    | 3s ease-in-out infinite | "Start Your Project!" nav link glow   |
| `nav-highlight-bg` | 3s ease-in-out infinite | Nav highlight background pulse        |
| `gradient-shimmer` | 4s ease-in-out infinite | Gradient background shift             |
| `hero-glow`        | 3s ease-in-out infinite | Hero text glow effect                 |

---
