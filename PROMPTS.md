# DispoTrack — Claude Code Prompt Reference

> Copy/paste prompt templates for working through the project phases. Each template is optimized to leverage Claude Code's parallel sub-agents, task tracking, and agent context files.

---

## General Template

Use this for any step. Replace `X.X` and `[step name]` with the actual phase/step.

```
@TODO.md @CLAUDE.md @.agents/

Mark the previous step as complete. Proceed with Phase X.X — [step name] and ONLY that step.

Use the relevant agent context from .agents/ for domain knowledge. Spawn parallel sub-agents (Task tool) for any independent sub-tasks that can run simultaneously. Use TaskCreate to track sub-tasks within this step.

Any issues or questions during work — ask me. When complete, summarize what was done, what to verify (if anything), and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

## Phase-Specific Templates

### Phase 0: Foundation (Project Setup, Supabase, Auth, App Shell)

**0.1 — Initialize Next.js Project**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md

Proceed with Phase 0.1 — Initialize Next.js Project and ONLY that step.

Use ui-builder agent context for Tailwind theme config and shadcn setup. Spawn parallel sub-agents for independent tasks (e.g., installing dependencies and configuring Tailwind simultaneously). Use TaskCreate to track sub-tasks.

Important: Use Next.js 15 with App Router, TypeScript, Tailwind CSS v4, flat app/ directory. Install all shadcn components listed in the TODO.

Any issues or questions — ask me. When complete, tell me how to verify the dev server runs correctly and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**0.2 — Set Up Supabase**
```
@TODO.md @CLAUDE.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 0.2 — Set Up Supabase and ONLY that step.

Use api-architect agent context for the full schema SQL, indexes, and RLS policies. The schema is fully defined in the agent file — use it directly. Spawn parallel sub-agents for independent tasks (e.g., creating migration files and generating TypeScript types simultaneously). Use TaskCreate to track each sub-task.

Important: Hard drives are normalized (child table, not 24 columns). Type-specific fields use JSONB. Include external_reference_id fields for future Sage integration. Create the asset_status_history table for audit compliance.

Any issues or questions — ask me. When complete, list any manual steps I need to do in the Supabase dashboard and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**0.3 — Set Up Auth**
```
@TODO.md @CLAUDE.md @.agents/api-architect.md @.agents/ui-builder.md

Mark the previous step as complete. Proceed with Phase 0.3 — Set Up Auth and ONLY that step.

Use api-architect for Supabase Auth client helpers, middleware, and user_profiles trigger. Use ui-builder for the login page UI. Spawn parallel sub-agents for independent tasks (e.g., building client helpers and login page simultaneously). Use TaskCreate to track sub-tasks.

Important: No self-signup. Admin creates users. Roles: admin, operator, viewer. Middleware protects all routes except /login.

Any issues or questions — ask me. When complete, tell me how to test the auth flow (log in, protected redirect) and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**0.4 — App Shell & Layout**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md

Mark the previous step as complete. Proceed with Phase 0.4 — App Shell & Layout and ONLY that step.

Use ui-builder agent context for layout patterns, sidebar nav, header, and component organization. Spawn parallel sub-agents for independent components (sidebar, header, and placeholder pages can all be built simultaneously). Use TaskCreate to track each component.

Sidebar links: Dashboard, Transactions, Assets, Clients, HD Crush, Reports, Admin (admin only). Header: global search trigger (Cmd+K), user menu with name + role badge + logout.

Any issues or questions — ask me. When complete, tell me how to verify navigation works in the browser and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

### Phase 1: Core Data Entry (Clients, Transactions, Asset Intake, Asset Edit)

**1.1 — Client Management**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 1.1 — Client Management and ONLY that step.

Use ui-builder for the client list and form UI, api-architect for server actions and validation. Spawn parallel sub-agents for independent tasks (client list page and client form can be built simultaneously). Use TaskCreate to track sub-tasks.

Key: Account number must be unique. Client dropdown will be reused in the Transaction form later, so build it as a reusable component.

Any issues or questions — ask me. When complete, tell me how to test creating and editing clients and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**1.2 — Transaction Management**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 1.2 — Transaction Management and ONLY that step.

Use ui-builder for form/list UI, api-architect for server actions, workflow-expert for transaction number format and customer data flow. Spawn parallel sub-agents for list page and form page simultaneously. Use TaskCreate to track sub-tasks.

Key: Transaction number format is T{YYYYMMDD}.{sequence}. Selecting a customer should auto-populate address info. Show asset count and status summary on transaction detail page.

Any issues or questions — ask me. When complete, tell me how to test creating transactions and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**1.3 — Initial Data Collection Form**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 1.3 — Initial Data Collection Form and ONLY that step.

Use ui-builder for the intake form UX (quick-add mode), api-architect for createAsset server action, workflow-expert for the intake process flow. Use TaskCreate to track sub-tasks.

This is the "Initial DC Form" from Caspio. Key UX: after submitting one asset, keep transaction context and clear only asset fields for rapid batch entry. Show running list of assets entered below the form. Auto-set status to "received" and log to status history.

Any issues or questions — ask me. When complete, tell me how to test entering multiple assets for a transaction and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**1.4 — Asset Edit Form (Smart Tabbed)**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 1.4 — Asset Edit Form (Smart Tabbed) and ONLY that step.

Use ui-builder for the tabbed form layout and conditional field visibility, api-architect for all the update server actions, workflow-expert for field requirements per asset type. Spawn parallel sub-agents for independent tab components. Use TaskCreate to track each tab.

This is the core improvement over Caspio's massive scrolling form. Tabs: Product Info, Hardware, Testing, Type-Specific (conditional), Status, Sanitization, Sales, History. Hard drives use dynamic add/remove rows. Status changes require reason and auto-log to history.

See the Asset Type → Visible Fields Matrix in ui-builder.md for which fields show per type.

Any issues or questions — ask me. When complete, tell me which asset types to test and what tab interactions to verify, and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

### Phase 2: Asset Processing & Search

**2.1 — Asset List & Search**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 2.1 — Asset List & Search and ONLY that step.

Use ui-builder for the data table, filters, and pagination, api-architect for the query patterns and CSV export. Spawn parallel sub-agents for table component and filter sidebar simultaneously. Use TaskCreate to track sub-tasks.

This replaces Caspio's "Download/Edit Asset Report". Must handle 500+ records per transaction. Filters stored in URL params. CSV export button. Click row to navigate to asset detail.

Any issues or questions — ask me. When complete, tell me which filters to test and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**2.2 — Asset Detail View**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 2.2 — Asset Detail View and ONLY that step.

Use ui-builder for the read-only detail layout, api-architect for the data fetching query. Use TaskCreate to track sub-tasks.

Same tabbed layout as the edit form but read-only. Show full transaction context, clean hard drive table (not empty rows), and status history timeline.

Any issues or questions — ask me. When complete, tell me what to check and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**2.3 — HD Crush Workflow**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 2.3 — HD Crush Workflow and ONLY that step.

Use ui-builder for the crush form UI, api-architect for the HD lookup query and crush action, workflow-expert for the crush process rules. Use TaskCreate to track sub-tasks.

Workflow: Search by HD serial → show parent asset → select destruct/shred method → enter crush date → save. Auto-update asset sanitization if all drives are crushed. Show Details/Edit links to parent asset.

Any issues or questions — ask me. When complete, provide test scenarios and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**2.4 — Global Search**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 2.4 — Global Search and ONLY that step.

Use ui-builder for the Command palette (Cmd+K) component, api-architect for the search endpoint. Spawn parallel sub-agents (API route and UI component simultaneously). Use TaskCreate to track sub-tasks.

Search across assets (serial, model), transactions (number), clients (name, account number). Results grouped by type. Keyboard navigation. Debounced 300ms.

Any issues or questions — ask me. When complete, tell me search queries to test and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

### Phase 3: Reports & Certificates

**3.1 — Certificate of Disposition**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 3.1 — Certificate of Disposition and ONLY that step.

Use ui-builder for the report layout and print CSS, api-architect for the data query, workflow-expert for the exact certification language and column requirements. Use TaskCreate to track sub-tasks.

Reference the Caspio_Asset Disposition Report.png screenshot in projectinfo/ for the exact format. Must include: Logista logo, date, transaction number, customer name/address, formal certification text, asset table. Print CSS must produce a clean, professional document.

Any issues or questions — ask me. When complete, tell me how to test generating and printing a certificate and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**3.2 — Certificate of Sanitization**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md @.agents/workflow-expert.md

Mark the previous step as complete. Proceed with Phase 3.2 — Certificate of Sanitization and ONLY that step.

Use ui-builder for the report layout and print CSS, api-architect for the data query (joins assets with hard drives and sanitization), workflow-expert for the NIST 800-88 certification language. Use TaskCreate to track sub-tasks.

Reference the Caspio_Asset Sanitization Report.png screenshot in projectinfo/ for the exact format. Only shows assets with hard drives/sanitization records. Includes hard drive serial numbers and sanitization method per asset. References "Logista Solutions, 401 Yorkville Rd E, Columbus, MS".

Any issues or questions — ask me. When complete, tell me how to test and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**3.3 — Reports Hub**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md

Mark the previous step as complete. Proceed with Phase 3.3 — Reports Hub and ONLY that step.

Use ui-builder for the reports landing page layout. Cards for each report type with description and quick-search by transaction number.

Any issues or questions — ask me. When complete, tell me what to check and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

### Phase 4: Dashboard & Polish

**4.1 — Dashboard**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 4.1 — Dashboard and ONLY that step.

Use ui-builder for dashboard layout, stat cards, and quick actions, api-architect for dashboard data queries. Use TaskCreate to track sub-tasks.

Stats: total assets by status, received this week/month, pending sanitization, available for sale. Recent transactions list. Quick action cards: New Transaction, Asset Intake, HD Crush, Generate Report.

Any issues or questions — ask me. When complete, tell me what to check on the dashboard and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**4.2 — Admin Panel**
```
@TODO.md @CLAUDE.md @.agents/api-architect.md @.agents/ui-builder.md

Mark the previous step as complete. Proceed with Phase 4.2 — Admin Panel and ONLY that step.

Use api-architect for user creation via supabase.auth.admin.createUser() and role management, ui-builder for the admin UI. Use TaskCreate to track sub-tasks.

Admin-only route protection. Create user, edit role, deactivate user. Uses service-role key (server-side only).

Any issues or questions — ask me. When complete, tell me how to test and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**4.3 — Performance & UX**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 4.3 — Performance & UX and ONLY that step.

Use ui-builder for loading states and error boundaries, api-architect for query optimization. Spawn parallel sub-agents for independent optimizations. Use TaskCreate to track sub-tasks.

Add skeletons to all data-fetching pages. Error boundaries (error.tsx + not-found). Toast notifications. Confirm dialogs for destructive actions. Test with 500+ records.

Any issues or questions — ask me. When complete, summarize optimizations and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**4.4 — Responsive & Accessibility**
```
@TODO.md @CLAUDE.md @.agents/ui-builder.md

Mark the previous step as complete. Proceed with Phase 4.4 — Responsive & Accessibility and ONLY that step.

Use ui-builder for responsive breakpoints, keyboard navigation, ARIA labels, and contrast checks. Spawn parallel sub-agents for independent audits. Use TaskCreate to track each audit area.

Any issues or questions — ask me. When complete, list manual checks I should do in the browser and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

---

### Phase 5: Deploy & Migration

**5.1 — Production Hardening**
```
@TODO.md @CLAUDE.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 5.1 — Production Hardening and ONLY that step.

Use api-architect for security headers, environment variable audit, and error handling review. Use TaskCreate to track sub-tasks.

Any issues or questions — ask me. When complete, provide a production readiness checklist and what the next step is.

Do not commit until I review. No co-authoring on commits.
```

**5.2 — Production Deployment**
```
@TODO.md @CLAUDE.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 5.2 — Production Deployment and ONLY that step.

Use api-architect for environment variable configuration and production checks. Use TaskCreate to track sub-tasks.

Any issues or questions — ask me. When complete, list all manual Vercel dashboard steps and the end-to-end test checklist.

Do not commit until I review. No co-authoring on commits.
```

**5.3 — Data Migration Strategy**
```
@TODO.md @CLAUDE.md @.agents/data-engineer.md @.agents/api-architect.md

Mark the previous step as complete. Proceed with Phase 5.3 — Data Migration Strategy and ONLY that step.

Use data-engineer for the Caspio-to-DispoTrack column mapping and migration script, api-architect for the target schema. Use TaskCreate to track sub-tasks.

Critical: the hard drive denormalization (24 flat columns → normalized rows). Extract unique clients from transaction data. Map Caspio status values to new enum. Test with sample export.

Any issues or questions — ask me. When complete, provide migration instructions and what to verify.

Do not commit until I review. No co-authoring on commits.
```

---

## Approval / Commit Prompt

Use this after you've reviewed the work and are ready to approve. Copy/paste as-is.

```
Approved and completed. Do the following without asking me:

1. Stage and commit all changes locally. No co-authoring. Write a clear commit message.
2. Mark all completed checkboxes [x] in TODO.md for this step. Update the Progress Tracker table if a full phase just finished.
3. Mark any TaskCreate tasks for this step as completed via TaskUpdate.
4. Append a summary of this step to TaskSummaries.md (create if it doesn't exist). Format: step number, what was done, any notable decisions. Keep it concise.
5. If we discussed and resolved any issues during this step, append them to ISSUES.md (create if it doesn't exist). If no issues, skip this.
6. Update memory (MEMORY.md) with current progress so future sessions know where we left off.
7. Tell me what the next step is so I can grab the prompt.
```

### If You Need to Reject / Request Changes

```
Not approved yet. [Describe what needs to change]. Fix these issues, then summarize what you changed. Do not commit until I re-review.
```

### If There Were No Code Changes (e.g., manual Supabase step)

```
Approved and completed — no code changes needed. Do the following without asking me:

1. Mark all completed checkboxes [x] in TODO.md for this step. Update the Progress Tracker table if a full phase just finished.
2. Mark any TaskCreate tasks for this step as completed via TaskUpdate.
3. Append a summary of this step to TaskSummaries.md (create if it doesn't exist).
4. If we discussed and resolved any issues, append to ISSUES.md. If not, skip.
5. Update memory (MEMORY.md) with current progress.
6. Tell me what the next step is.
```

---

## Tips

- **Always reference `@TODO.md` and `@CLAUDE.md`** — These are the source of truth for what to build and how.
- **Reference specific agent files** when the step has a clear domain — `@.agents/ui-builder.md` for UI work, `@.agents/api-architect.md` for backend, etc. Using all four at once dilutes focus.
- **"ONLY that step"** keeps scope tight and prevents scope creep across phases.
- **"Spawn parallel sub-agents"** explicitly tells Claude Code to use the Task tool for concurrent work.
- **"Use TaskCreate"** gives you visible progress tracking as work happens.
- **Phase-specific verification asks** get you the right kind of output: UI work → browser checks, API work → test commands, reports → print checks, deploy work → manual steps.
- **"Do not commit until I review"** keeps you in control of the git history.
- **"No co-authoring on commits"** removes the `Co-Authored-By` line from commit messages.
- **Reference screenshots**: The Caspio screenshots in `projectinfo/Caspio Screenshots/` are the ground truth for what each form and report should contain.
