# DispoTrack — Task Summaries

## Phase 0.1 — Initialize Next.js Project

**What was done:**
- Created Next.js 16.1.6 project with TypeScript, Tailwind CSS v4, App Router, flat `app/` directory
- Installed core deps: `@supabase/supabase-js`, `@supabase/ssr`, `framer-motion`, `lucide-react`
- Initialized shadcn/ui and installed 22 components (button, input, card, badge, table, tabs, dialog, sonner, skeleton, separator, select, tooltip, sheet, dropdown-menu, form, label, textarea, checkbox, radio-group, calendar, popover, command)
- Configured Tailwind v4 `@theme inline` with custom colors: teal primary, dark sidebar, 9 status colors, 9 asset type colors
- Updated root layout with TooltipProvider, Toaster, and DispoTrack metadata
- Created placeholder landing page, `.env.local`, configured `.gitignore`
- Initialized git repo and committed

**Notable decisions:**
- `date-picker` doesn't exist in shadcn registry; using `calendar` + `popover` combo instead
- Used Tailwind v4 `@theme inline` CSS variables (not tailwind.config.js which is v3 pattern)
- Theme uses oklch color space throughout for consistency with shadcn v4 defaults
- `projectinfo/` excluded from git (reference material only)
- Next.js version is 16.1.6 (latest as of creation despite TODO saying "15")
