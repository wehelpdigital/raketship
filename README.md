# RaketShip

A mobile-first SaaS toolkit for Filipino MSMEs — the *raketeros*, sari-sari owners and
side-hustlers who need real business software but only ever want to pay for the next
notch they actually need.

**"Tingi" pricing, applied to software.** Start free. Move to Basic when you outgrow it.
Then buy individual modules from a marketplace and upgrade each one on its own ladder —
a Booking module that only takes appointments today can grow SMS reminders next month and
deposit collection the month after, without paying for either until you want them.

The centrepiece is **Build your Raket** (a homophone of "rocket"): a drag-and-drop canvas
where your activated modules become nodes joined by lines. Open a module and you drop into
its own builder. The Booking module ships pre-wired — **Booking → Timer → Email**.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 |
| Styling | Tailwind v4 (CSS-first tokens, no config file) |
| Components | shadcn/ui on Base UI |
| Canvas | React Flow (`@xyflow/react`) |
| Backend | Supabase (Postgres + Auth), RLS on every user table |
| Tests | Vitest + Testing Library |

---

## Getting started

```bash
npm install
```

### 1. Point the app at Supabase

Copy the template and fill it in:

```bash
cp .env.example .env.local
```

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dashboard → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Dashboard → Project Settings → **API Keys** → the `sb_publishable_…` key |
| `SUPABASE_SECRET_KEY` | same page, the `sb_secret_…` key — **server only** |

> This project uses Supabase's **new API key system**. The old `anon` JWT is disabled and
> returns `Invalid API key`; you need the `sb_publishable_…` key, not the legacy one.

### 2. Create the schema

Either apply the migrations directly:

```bash
# add SUPABASE_DB_URL=postgresql://... to .env.local first
# (Dashboard → Project Settings → Database → Connection string → URI)
npm run db:push
```

…or, with no database password to hand, open **`supabase/setup.sql`**, paste the whole file
into the Supabase **SQL Editor**, and hit Run. Both paths are idempotent.

### 3. Create the demo admin

```bash
npm run db:seed-admin
```

This uses the Admin API to create a pre-confirmed account, so there is no inbox round-trip.
It powers the one-click **Dev shortcut** button under the sign-in form. Credentials come
from `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD` in `.env.local`.

### 4. Run it

```bash
npm run dev
```

### Optional — Google sign-in

The Google button is already built, but the provider must be switched on:
**Dashboard → Authentication → Providers → Google**, add an OAuth client ID and secret, and
add `http://localhost:3000/auth/callback` to the redirect allow-list. Until then the button
explains itself with a toast rather than failing silently.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm test` | Vitest, once |
| `npm run test:watch` | Vitest, watching |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | typecheck + lint + test |
| `npm run db:push` | Apply `supabase/migrations/*` |
| `npm run db:seed-admin` | Create/repair the demo admin |

---

## How the data model works

```
profiles ─┬─ subscriptions ── plans
          ├─ user_modules ──┬─ modules
          │                 └─ module_tiers      (starter → plus → pro)
          └─ rakets ── flows ─┬─ flow_nodes
                              └─ flow_edges
```

`flows` carries a `kind` discriminator and does double duty:

- `kind='raket'` — the **outer** canvas, one per raket. Its nodes are the modules you own.
- `kind='module'` — an **inner** canvas, one per placed module node, linked back through
  `parent_node_id`.

One node/edge schema serves both canvases, so a new element type is a registry entry rather
than a migration.

Every user-scoped table is under RLS with `auth.uid() = user_id`. The catalogue tables
(`plans`, `modules`, `module_tiers`) are world-readable so pricing can render for signed-out
visitors.

### Adding a builder element

Add one entry to [`src/lib/flow/registry.ts`](src/lib/flow/registry.ts). The palette, the
node card, the inspector form and the tier gating all read from that table — no React Flow
wiring required. To sell it, add its `type` to the relevant tier's `node_types` array in
[`supabase/migrations/0002_seed_catalog.sql`](supabase/migrations/0002_seed_catalog.sql).

---

## Project layout

```
src/
  app/
    (auth)/          sign-in, register
    (app)/           the authenticated shell
      dashboard/
      raket/         [nodeId]/  ← the inner module builder
      marketplace/   [moduleId]/
      account/
    auth/callback/   OAuth code exchange
  components/
    ui/              shadcn/ui primitives
    shell/           header, bottom nav, page container
  features/          auth · account · marketplace · builder
  lib/
    flow/            element registry + DB↔canvas mappers
    queries/         server-only data access
    supabase/        browser · server · admin clients
supabase/
  migrations/        0001 schema · 0002 catalogue · 0003 provisioning
  setup.sql          all three concatenated, for the SQL Editor
```

---

## Notes on design

The whole app is laid out at 390px first. Navigation is a bottom tab bar with safe-area
padding; primary actions are 44px tall; inputs carry a 16px floor so iOS Safari does not
zoom on focus. Spacing follows one scale throughout — `px-4 sm:px-6` gutters, `py-6` page
padding, `space-y-6` between sections, `space-y-3` within them — so vertical rhythm stays
even from screen to screen.

Colour is entirely token-driven (`bg-card`, `text-muted-foreground`, `bg-chart-3/12`), which
is what lets dark mode be a deliberate palette rather than an inversion.
