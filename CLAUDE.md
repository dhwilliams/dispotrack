# DispoTrack — Asset Disposition Tracking System

Replacement for Caspio-based asset disposition tracker used at the LR3 facility (Columbus, MS), with planned expansion to Depot operations. Tracks IT equipment from customer receipt through testing, grading, sanitization (wipe or crush), and final disposition (resale or recycle). Produces audit-ready Certificate of Disposition, Certificate of Sanitization, Certificate of Data Destruction, and Certificate of Recycling reports (NIST 800-88 compliance). Separates asset lifecycle tracking from inventory management (Sage STOCK/STOJOU pattern).

## Tech Stack

- **Next.js 15** (App Router, TypeScript, `app/` directory)
- **Tailwind CSS v4** + **shadcn/ui** (component library)
- **Framer Motion** (animations)
- **Supabase** (PostgreSQL, Auth, RLS)
- **Vercel** (deployment)

## Commands

- `npm run dev` — Start dev server (port 3000)
- `npm run build` — Production build
- `npm run lint` — ESLint check
- `npx supabase db push` — Push migrations to Supabase
- `npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts` — Regenerate DB types

## Architecture

```
app/
├── (auth)/           # Login page, auth callback
├── (app)/            # Protected app routes (layout with sidebar)
│   ├── page.tsx      # Dashboard
│   ├── transactions/ # Transaction CRUD
│   ├── assets/       # Asset list, detail, edit, intake
│   ├── clients/      # Client management + revenue terms
│   ├── inventory/    # Inventory management (stock on hand, journal, transfers)
│   ├── reports/      # Disposition, Sanitization, Destruction, Recycling certificates
│   ├── hd-crush/     # Hard drive destruction workflow
│   └── admin/        # User management, routing rules, field definitions, buyers (admin only)
├── api/              # Route handlers
components/
├── ui/               # shadcn base components
├── layout/           # Sidebar, header, page container
├── forms/            # Asset form, transaction form, intake, inventory, buyer, etc.
├── tables/           # Asset table, inventory table, journal table, buyer table
├── reports/          # Certificate templates (disposition, sanitization, destruction, recycling)
└── shared/           # Reusable components (badges, selects, barcode scanner, photo upload)
lib/
├── supabase/         # Client helpers, server client, middleware, types
├── utils/            # Formatters, validators, constants
└── hooks/            # Custom React hooks
```

## Code Style

- TypeScript strict mode. No `any` types — use `unknown` and narrow.
- Server components by default; add `"use client"` only when needed (event handlers, hooks, browser APIs).
- Use Server Actions for mutations (form submissions, status changes).
- Colocate server actions in `actions.ts` next to their page.
- Prefer `@supabase/ssr` for server-side Supabase clients.
- Destructure imports. Use `import type { ... }` for type-only imports.
- Use Tailwind classes. Never write raw CSS unless for print stylesheets.

## Database

- See @.agents/api-architect.md for full schema.
- **Assets ≠ Inventory**: Separate tables. Assets = identity/lifecycle (persists forever). Inventory = physical stock on hand.
- **Stock journal pattern** (Sage STOCK/STOJOU model): `inventory` for aggregate stock levels, `inventory_journal` for append-only ledger of all movements. Corrections = reversal + new entry, never edits.
- Hardware fields (CPU, memory, chassis, optical drive, color) merged into `asset_type_details` JSONB — no separate `asset_hardware` table.
- `asset_type_field_definitions` table: admin-configurable fields per asset type. Drives dynamic form rendering.
- **Drive-level sanitization**: sanitization fields on `asset_hard_drives`, not just device-level. `asset_sanitization` remains for device-level notes on non-storage assets.
- `internal_asset_id` auto-generated on every asset (e.g., "LR3-000001"). `serial_number` is nullable (not all items have serials at intake).
- `tracking_mode`: 'serialized' (one per unit) or 'bulk' (one per batch, qty > 1).
- `buyers` table normalizes repeat buyer info out of `asset_sales`. Linked via `buyer_id` FK.
- `client_revenue_terms` + `asset_settlement`: versioned revenue sharing per client, per-sale settlement calculations.
- `routing_rules`: admin-configurable rules engine for auto-suggesting disposition path at triage.
- Hard drives are **normalized** (child table `asset_hard_drives`), not 24 separate columns.
- Type-specific fields (laptop battery, printer toner, etc.) stored as **JSONB** in `asset_type_details`.
- `external_reference_id` fields on `clients` and `assets` for Sage/Depot integration.
- `asset_status_history` table tracks every status change for audit compliance.
- Status lifecycle: `received → in_process → tested → graded → sanitized → available → sold | recycled`

## Auth

- Supabase Auth, email/password only. **No self-signup.** Admins create users via admin panel.
- Roles: `admin`, `operator`, `viewer`, `receiving_tech`, `client_portal_user`
- RLS on all tables. Operators can CRUD assets/transactions. Viewers read-only. Admins manage users + config. Receiving techs can create transactions/assets. Client portal users see only their own client's data.
- Middleware protects all routes except `/login`.

## Workflow Rules

- IMPORTANT: Always reference `@TODO.md` for what to build and this file for how.
- IMPORTANT: Complete ONE step at a time. Do not jump ahead.
- Use the relevant `.agents/` file for domain context (not all four at once).
- Use TaskCreate to track sub-tasks within each step.
- Spawn parallel sub-agents (Task tool) for independent work.
- Do not commit until the user reviews. No co-authoring on commits.
- When building forms, render fields dynamically from `asset_type_field_definitions` — not hardcoded per type.
- Reports (Certificate of Disposition, Certificate of Sanitization, Certificate of Data Destruction, Certificate of Recycling) use HTML + print CSS, not PDF generation.
- Label printing is optional — never a required workflow step. Never gates progress.
- Inventory journal is append-only. Corrections are reversal + new entry.

## Asset Types & Their Fields

All assets share: internal_asset_id (auto), serial_number (optional), asset_type, manufacturer, model, model_name, mfg_part_number, asset_tag, quantity, tracking_mode, unit_of_measure, weight, notes.

**Fields per asset type are admin-configurable via `asset_type_field_definitions`.** The table below shows the default seed data:

| Asset Type | Hardware Fields | Type-Specific Fields |
|------------|----------------|---------------------|
| Desktop | CPU, memory, optical drive, chassis type, color | — |
| Server | CPU, memory, chassis type, color | — |
| Laptop | CPU, memory, optical drive, color | battery, battery_held_30min, webcam, screen_size, screen_condition, keyboard_works, ac_adapter |
| Monitor | — | screen_size, screen_condition, color |
| Printer | — | printer_type, sheet_tray, duplexer, page_count, laser_or_inkjet, new_used_toner, wireless, serial_cable, num_ports |
| Phone | — | phone_receiver, receiver_cord, cordless |
| TV | — | television_type, screen_size |
| Network | — | wifi_capabilities, half_or_full_rack, num_ports |
| Other | — | description (free text) |

## Grading System

- **Cosmetic**: C1 (New), C2 (Like New), C3 (Good), C4 (Used Good), C5 (Poor)
- **Functional**: F1 (Fully Functional), F2 (Minor Issues), F3 (Key Functions Working), F4 (Major Issues), F5 (Non-Functional)

## Important Notes

- NEVER commit `.env.local` or expose Supabase service role keys client-side.
- The Logista logo is used on certificate reports — store in `public/logista-logo.png`.
- Transaction numbers follow pattern: `T{date}.{sequence}` (e.g., T20251030.00210).
- Customer account numbers are short codes like "BA0400".
- Audit compliance is critical — every status change must be logged with who/when/why. Every inventory movement logged via append-only journal.
- This system must coexist with Caspio until validated (audit in April).
- Building for Depot expansion — asset/inventory separation, configurable field definitions, and stock journal pattern support both LR3 and Depot from day one.
- Label printing is available but optional — never gates workflow progress.
- See `docs/DEPOT_DESIGN.md` for full architectural rationale on asset vs inventory separation, stock journal pattern, and Depot expansion plans.
