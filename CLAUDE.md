# DispoTrack — Asset Disposition Tracking System

Replacement for Caspio-based asset disposition tracker used at the LR3 facility (Columbus, MS). Tracks IT equipment from customer receipt through testing, grading, sanitization (wipe or crush), and final disposition (resale or recycle). Produces audit-ready Certificate of Disposition and Certificate of Sanitization reports (NIST 800-88 compliance).

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
│   ├── assets/       # Asset list, detail, edit
│   ├── clients/      # Client management
│   ├── reports/      # Disposition & Sanitization certificates
│   ├── hd-crush/     # Hard drive destruction workflow
│   └── admin/        # User management (admin only)
├── api/              # Route handlers
components/
├── ui/               # shadcn base components
├── layout/           # Sidebar, header, page container
├── forms/            # Asset form, transaction form, etc.
├── reports/          # Certificate templates
└── shared/           # Reusable components
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
- Hard drives are **normalized** (child table `asset_hard_drives`), not 24 separate columns.
- Type-specific fields (laptop battery, printer toner, etc.) stored as **JSONB** in `asset_type_details`.
- `external_reference_id` fields on `clients` and `assets` for future Sage/Depot integration.
- `asset_status_history` table tracks every status change for audit compliance.
- Status lifecycle: `received → in_process → tested → graded → sanitized → available → sold | recycled`

## Auth

- Supabase Auth, email/password only. **No self-signup.** Admins create users via admin panel.
- Roles: `admin`, `operator`, `viewer`
- RLS on all tables. Operators can CRUD assets/transactions. Viewers read-only. Admins manage users.
- Middleware protects all routes except `/login`.

## Workflow Rules

- IMPORTANT: Always reference `@TODO.md` for what to build and this file for how.
- IMPORTANT: Complete ONE step at a time. Do not jump ahead.
- Use the relevant `.agents/` file for domain context (not all four at once).
- Use TaskCreate to track sub-tasks within each step.
- Spawn parallel sub-agents (Task tool) for independent work.
- Do not commit until the user reviews. No co-authoring on commits.
- When building forms, show only fields relevant to the selected Asset Type.
- Reports (Certificate of Disposition, Certificate of Sanitization) use HTML + print CSS, not PDF generation.

## Asset Types & Their Fields

All assets share: serial_number, asset_type, manufacturer, model, model_name, mfg_part_number, asset_tag, quantity, notes.

| Asset Type | Additional Fields |
|------------|------------------|
| Desktop | chassis_type, CPU, memory, hard drives, optical drive, color |
| Server | chassis_type, CPU, memory, hard drives, color |
| Laptop | CPU, memory, hard drives, battery, webcam, screen_size, screen_condition, keyboard_works, ac_adapter |
| Monitor | screen_size, screen_condition, color |
| Printer | printer_type, sheet_tray, duplexer, page_count, laser_or_inkjet, new_used_toner, wireless, serial_cable, num_ports |
| Phone | phone_receiver, receiver_cord, cordless |
| TV | television_type, screen_size |
| Network | wifi_capabilities, half_or_full_rack, num_ports |
| Other | description (free text) |

## Grading System

- **Cosmetic**: C1 (New), C2 (Like New), C3 (Good), C4 (Used Good), C5 (Poor)
- **Functional**: F1 (Fully Functional), F2 (Minor Issues), F3 (Key Functions Working), F4 (Major Issues), F5 (Non-Functional)

## Important Notes

- NEVER commit `.env.local` or expose Supabase service role keys client-side.
- The Logista logo is used on certificate reports — store in `public/logista-logo.png`.
- Transaction numbers follow pattern: `T{date}.{sequence}` (e.g., T20251030.00210).
- Customer account numbers are short codes like "BA0400".
- Audit compliance is critical — every status change must be logged with who/when/why.
- This system must coexist with Caspio until validated (audit in April).
