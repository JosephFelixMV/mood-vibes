# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Mood & Vibes** (mood-and-vibes.com) is a product discovery affiliate platform that surfaces curated products by mood, vibe, and lifestyle category. All monetization is affiliate commission — clicking through to a retailer is the core conversion event.

Platform identity is **curated discovery** — generic apparel (plain shirts, pants, basic shoes) is excluded in favour of distinctive, statement items.

## Development Workflow

- **Active branch:** `Lovable-Dev` — all changes stay on this branch, never commit directly to `main`
- **Primary build tool:** Lovable (syncs with lovable-dev via GitHub)
- **Run Lovable prompts one at a time** — never combine security + feature changes in a single prompt
- Production URL: `https://www.mood-and-vibes.com`
- Supabase Auth Site URL must point to `https://www.mood-and-vibes.com` (not the Lovable preview URL) — update in Supabase Dashboard → Authentication → URL Configuration after any domain change

## Commands

```bash
npm run dev          # Start Vite dev server on localhost:8080
npm run build        # Production build
npm run lint         # ESLint (TypeScript + React rules)
npm run preview      # Preview production build locally
npm run test         # Vitest unit tests (single run)
npm run test:watch   # Vitest in watch mode
```

Playwright e2e tests live in `e2e/`. Run with `npx playwright test`.

## Tech Stack

- **React 18 + Vite + TypeScript** (SWC transpiler, path alias `@` → `./src`)
- **React Router v6** for routing
- **TanStack React Query v5** for server state
- **Supabase** (PostgreSQL + Auth + Edge Functions) as the backend
- **Tailwind CSS + Shadcn/UI** (Radix primitives, default style, slate base, CSS variables enabled)
- **React Hook Form + Zod** for forms
- **TipTap** for rich-text editing in admin
- **Framer Motion** for animations

## Path Aliases

- Components: `@/components`
- UI primitives: `@/components/ui` (shadcn)
- Utilities: `@/lib/utils`
- Hooks: `@/hooks`
- Lib/queries: `@/lib`

## Architecture

### Routing (`src/App.tsx`)

Public: `/`, `/products`, `/product/:slug`, `/category/:slug`, `/vibes/:slug`, `/moods/:slug`, `/discover`, `/brands`, `/categories`, `/vibes`, `/moods`, `/about`, `/disclosure`, `/privacy`, `/terms`

Protected: `/admin` — wrapped in `ProtectedRoute` (Supabase JWT + RLS enforced server-side)

### Data Fetching

All Supabase queries are centralized in **`src/lib/supabase-queries.ts`** — do not call Supabase directly from components. React Query wraps these in pages/hooks.

Supabase enforces a 1000-row limit; queries use pagination where needed. Region filtering (`filterByRegion()`) is applied client-side based on the product `regions` field.

All Supabase queries must use **server-side filters with `.limit()` caps** — `CategoryLanding`, `VibeLanding`, `MoodLanding`, and `Index.tsx` must never do full-table fetches filtered in JavaScript.

### Analytics

Two tracking utilities:
- **`src/lib/track-event.ts`** — IntersectionObserver fires `"view"` events when products enter the viewport; deduped per session via sessionStorage and bot-user-agent filtered.
- **`src/lib/track-click.ts`** — logs affiliate link clicks to `product_clicks` table.

Both silently swallow errors to never interrupt the shopping UX.

### SEO

Use the **`useSEO()` hook** (`src/hooks/useSEO.tsx`) on every page. It injects meta tags, canonical URLs, Open Graph, and JSON-LD schemas (Product, CollectionPage, BreadcrumbList, WebSite).

### Admin Panel (`/admin`)

Full CRUD for products with a live preview pane. Key features:
- **AI Category Suggestions** — calls the `suggest-categories` Supabase Edge Function (Anthropic Claude API), which uses brand hints from `brand_lookup` table and enforces a drug/medical-claims blocklist.
- **Bulk Upload** — JSON import via `BulkUpload.tsx`.
- **Analytics Dashboard** — charts from `product_events` table.

### Supabase Edge Functions (`supabase/functions/`)

Deno/TypeScript functions:
- `suggest-categories` — AI categorization (Anthropic API). **Must read categories dynamically from Supabase `category_vibe_manager` tables — never use hardcoded category arrays.**
- `batch-suggest-update` — bulk AI re-categorization. **Same rule: categories must be read from DB, not hardcoded.**
- `discover-products` — date-seeded random product pick. **Must enforce server-side rate limiting to prevent runaway Anthropic API costs.**
- `validate-click` — affiliate click fraud detection
- `check-affiliate-links` — URL reachability check
- `sitemap` — dynamic XML sitemap for SEO
- `report-product`, `seed-brand-lookup`, `toggle-cron-job`

### AI Categorization

- Two-tier system: compressed ~900-token prompts for brand-matched products; full ~3,500-token prompts for unknown brands
- Confidence scoring: auto-apply (≥0.85), review queue (0.50–0.84), manual hold (<0.50)
- Keywords must include four mandatory types per product: descriptive, recipient/audience, occasion, mood/aesthetic (target 8–12 keywords per product)
- "Aura Farming" vibe = cinematic main character energy (leather, chrome, oversized tailoring, silent luxury) — not crystals/spiritual

### Compliance

- `AffiliateDisclosureBanner` must remain **persistent sitewide** and never be hidden — hover-only tooltips fail on mobile and Canadian Competition Bureau standards.
- "Price at retailer may vary" must be **always-visible inline text** on product cards — not hover-only.
- `RegionNoticeDialog` alerts non-US visitors (catalog is US-focused).
- Enzuzo cookie consent script is in `index.html`; `App.tsx` gates other dialogs until consent resolves (mobile race condition fix).
- Welcome modal shown to US visitors only (`?welcome_preview` query param available for local testing from non-US IP).

### Key Tables

| Table | Purpose |
|---|---|
| `products` | Core product records |
| `product_images` | Up to 4 gallery images per product |
| `product_specifications` | Key/value spec pairs |
| `product_events` | Analytics (view/click events) |
| `categories` | Taxonomy (type: core/vibe/mood) |
| `brand_lookup` | Brand hints for AI categorization |
| `daily_picks` | Product of the Day (RPC-generated) |
| `category_vibe_manager` | Source of truth for categories/vibes — Edge Functions must read from here |

## Security Rules

- **Never expose `service_role` key** in any frontend code — anon key only (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- All Supabase queries must use **server-side filters with `.limit()` caps** — no full-table fetches filtered client-side
- Edge Functions must read categories **dynamically from Supabase** — never hardcode category arrays (silently ignores admin UI edits)
- `/admin` route requires active **Supabase Auth session (JWT + TOTP 2FA)** — no password-only protection
- `AI Discover` Edge Function must enforce **server-side rate limiting** to prevent runaway Anthropic API costs
- Supabase RLS policies must be present and complete on all tables

## Environment Variables

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The Supabase anon key is safe to expose in frontend code. Edge functions use server-side secrets (set in Supabase dashboard, not `.env`).

## TypeScript Config

`noImplicitAny: false` and `skipLibCheck: true` — the config is intentionally lenient. Supabase types are auto-generated in `src/integrations/supabase/types.ts` (20K+ LOC); don't edit that file manually.
