# DispoTrack — End-to-End Testing Plan

> Comprehensive manual testing plan to reverify all features built in Phases 0–5.1.
> Run with `npm run dev` at http://localhost:3000.
> Seed data from `scripts/seed-clients.sql` and `scripts/seed-transactions-assets.sql` must be loaded first.
> For the 500+ asset volume test, run `scripts/seed-volume-test.sql` after.

---

## Prerequisites

1. `npm run dev` is running on port 3000
2. Seed clients loaded (10 clients via `scripts/seed-clients.sql`)
3. Seed transactions/assets loaded (10 transactions, 72 assets via `scripts/seed-transactions-assets.sql`)
4. Logged in as admin user (admin@logistasolutions.com)

---

## Phase 0: Foundation

### 0.3 — Auth

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 1 | Login page renders | Navigate to `/login` | Email/password form, DispoTrack branding |
| 2 | Login with valid credentials | Enter admin@logistasolutions.com + password, click Sign In | Redirects to `/` (dashboard) |
| 3 | Login with bad password | Enter admin email + wrong password | Error message displayed, stays on login page |
| 4 | Protected route redirect | Log out, navigate to `/assets` | Redirects to `/login` |
| 5 | Sign out | Click user menu → Sign out | Redirects to `/login`, can't access protected routes |

### 0.4 — App Shell

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 6 | Sidebar renders | Log in, observe sidebar | 7 nav items: Dashboard, Transactions, Assets, Clients, Inventory, HD Crush, Reports. Admin link visible for admin users. |
| 7 | Sidebar navigation | Click each sidebar link | Each page loads without error |
| 8 | Header renders | Observe header bar | Search button (Cmd+K), user avatar, name, role badge |
| 9 | Active nav highlighting | Click "Assets" | Assets link highlighted in sidebar |

---

## Phase 1: Core Data Entry

### 1.1 — Client Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 10 | Client list | Navigate to `/clients` | 10 seed clients listed. Account #, Name, Contact visible. |
| 11 | Client search | Type "baptist" in search, press Filter | Only Baptist Memorial shown |
| 12 | Create client | Click "+ New Client". Fill: Account Number: `TEST01`, Name: `Test Corp`, City: `Columbus`, State: `MS`, ZIP: `39701`. Submit. | Redirects to `/clients`. "Test Corp" appears in list. |
| 13 | Duplicate account # | Create another client with Account Number: `TEST01` | Error: account number already exists |
| 14 | Edit client | Click "TEST01" row → edit fields (change City to `Starkville`) → Save | Updated successfully. City shows Starkville. |
| 15 | Revenue terms | On client detail page, scroll to Revenue Terms. Click "Add Term". Select type: `percentage`, set percentage to `15`, effective date: `2026-01-01`. Save. | Revenue term appears in list with correct details. |

### 1.2 — Transaction Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 16 | Transaction list | Navigate to `/transactions` | 10 seed transactions listed with client names |
| 17 | Search transactions | Type "99003" in search, press Filter | Only T20260222.99003 shown |
| 18 | Date filter | Set From: `2026-03-01`, press Filter | Only T10, T7, T8, T9 shown (March transactions) |
| 19 | Create transaction | Click "+ New Transaction". Select client: Test Corp. Date: `2026-03-03`. Instructions: `Testing batch`. Submit. | Redirects to `/transactions`. New transaction appears with auto-generated number (T20260303.xxxxx). |
| 20 | Edit transaction | Click the new transaction → change Special Instructions → Save | Updated successfully |
| 21 | Transaction detail | Click any seed transaction (e.g., T20260215.99001) | Detail page shows: transaction number, date, client name, asset count breakdown by status and type |

### 1.3 — Asset Intake

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 22 | Intake page | Navigate to `/assets/intake` | Transaction select dropdown, asset form fields |
| 23 | Create serialized asset | Select the Test Corp transaction. Type: `desktop`, Serial: `TEST-SN-001`, Mfg: `Dell`, Model: `OptiPlex 7090`, Tag: `TC-PC-001`. Submit. | Toast: "Asset LR3-000073 created" (or next sequence). Asset ID displayed with copy button. |
| 24 | Create bulk asset | Select Test Corp txn. Type: `other`, Tracking: `Bulk`, Qty: `10`, Notes: `Box of keyboards`. Submit. | Toast confirms creation. Qty shows 10. |
| 25 | Quick-add mode | Create 3 assets in a row without changing transaction | Each creates successfully, shows in created list |
| 26 | Routing rule match | If a routing rule matches the asset type, verify suggestion appears | Suggested disposition shown (e.g., "Rule: Recycle small monitors") |
| 27 | Missing required field | Submit with no transaction selected | Validation error shown |
| 28 | Barcode scanner field | Click serial number input, type rapidly + press Enter within 100ms | Serial number populated (simulates scanner) |

### 1.4 — Asset Edit

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 29 | Navigate to edit | From `/assets`, click an asset row → click "Edit" button | 8-tab edit form loads |
| 30 | Product Info tab | Change manufacturer, click Save | Toast: "Saved successfully" |
| 31 | Hardware tab | For a desktop/laptop: Set CPU to `Intel i7-12700`, Memory to `16GB`. Save. | Saved. Values persist on reload. |
| 32 | Hard Drives tab | Click "Add Drive". Set Serial: `TEST-HD-001`, Mfg: `Seagate`, Size: `1TB`. Save. | Drive row added and saved. |
| 33 | Remove drive | Click X on a drive row → Confirm in dialog | Drive removed. Toast confirms. |
| 34 | Testing tab | Set Cosmetic: `C2`, Functional: `F1`, Power Up: Yes, Functions: Yes. Save. | Saved. Grading badge shows C2/F1. |
| 35 | Type-specific tab | For a laptop: toggle Battery, set Screen Size `15.6"`. Save. | Dynamic fields saved to asset_type_details JSONB. |
| 36 | Status tab | Read-only status history timeline | Shows all status changes with timestamps |
| 37 | Sanitization tab | Set method: `wipe`, details: `NIST 800-88 Clear`. Save. | Saved for device-level sanitization |
| 38 | Sales tab | Select/create a buyer. Set sale price: `150.00`, sold date: `2026-03-03`. Save. | Sale record saved. |

---

## Phase 2: Data Views & Search

### 2.1 — Asset List

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 39 | Asset list loads | Navigate to `/assets` | Table with 72+ assets. Shows "XX total assets". |
| 40 | Search filter | Type "OptiPlex" in search, click Filter | Only Dell OptiPlex assets shown |
| 41 | Type filter | Select "laptop" from Asset Type dropdown, Filter | Only laptop assets |
| 42 | Status filter | Select "available" from Status dropdown, Filter | Only available assets |
| 43 | Combined filters | Search: "Dell", Type: "desktop", Status: "received", Filter | Filtered results matching all 3 criteria |
| 44 | Date range | Set From: `2026-02-25`, To: `2026-02-28`, Filter | Only assets from those transaction dates |
| 45 | Sort by column | Click "Asset ID" header | Sorts ascending. Click again → descending. Third click → removes sort. |
| 46 | Pagination | Set per page to 25. Verify Previous/Next buttons. Navigate pages. | Correct page counts, data changes per page |
| 47 | Row click | Click an asset row (not the ID link or checkbox) | Navigates to `/assets/{id}` detail page |
| 48 | Keyboard nav | Tab to a table row, press Enter | Navigates to detail page |
| 49 | Reset filters | Click "Reset" link | All filters cleared, full list shown |
| 50 | CSV export | Click "Export CSV" | Downloads `assets-export.csv` with correct columns and filtered data |

### 2.1 — Bulk Actions

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 51 | Select multiple | Check 3 asset checkboxes | Selection count shows "3 selected" |
| 52 | Select all on page | Check the header checkbox | All visible rows selected |
| 53 | Bulk status change | Select 3 received assets → Bulk Action: Status → `in_process` → Apply → Confirm dialog | Toast: "Updated 3 assets". Assets now show "In Process" status. |
| 54 | Bulk destination | Select 2 assets → Destination → `external_reuse` → Apply → Confirm | Destination updated for both |

### 2.2 — Asset Detail View

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 55 | Detail page | Click asset LR3-000001 (or first seed asset) | Read-only view with 9 tabs |
| 56 | Product Info tab | View | Shows serial, type, mfg, model, tag, qty, tracking mode, weight, notes, transaction link |
| 57 | Hard Drives tab | View an asset with drives (Baptist desktop b...06) | Shows drive table with serial, mfg, size, sanitization method |
| 58 | Status History tab | View | Timeline of all status changes with who/when/why |
| 59 | Inventory tab | View | Shows inventory record (location, qty, status) + journal entries |
| 60 | Edit button | Click "Edit" | Navigates to `/assets/{id}/edit` |

### 2.3 — HD Crush Workflow

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 61 | Search by serial | Navigate to `/hd-crush`. Type `SEAGATE-ST1` in search. | Typeahead shows matching drive suggestions |
| 62 | Select drive | Click suggestion `SEAGATE-ST1-00A1` | Parent asset info appears: internal ID, type, mfg, model, transaction, customer. All drives for that asset listed. |
| 63 | Crush a drive | Click "Crush" on drive SEAGATE-ST1-00A1. Set method: `destruct_shred`, Tech: `Amber Holliday`, Date: `2026-03-03`. Submit. | Toast: "Drive crushed". Drive row updates to show crush date. |
| 64 | Crush remaining drives | Crush drives SEAGATE-ST1-00A2, 00A3, 00A4 | After all 4 crushed, asset status auto-updates to "sanitized". Toast confirms. |
| 65 | Search non-existent | Type `ZZZZZ-NOT-FOUND` | "No drive found" message |

### 2.4 — Global Search (Cmd+K)

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 66 | Open command palette | Press Cmd+K (or Ctrl+K) | Search dialog opens |
| 67 | Search assets | Type "LR3-0000" | Asset results appear with internal IDs, type badges, status badges |
| 68 | Search transactions | Type "T20260215" | Transaction result with client name |
| 69 | Search clients | Type "Baptist" | Client result with account number |
| 70 | Search inventory | Type "RECEIVING" | Inventory records at RECEIVING location |
| 71 | Navigate from result | Click an asset result | Dialog closes, navigates to `/assets/{id}` |
| 72 | Escape closes | Press Escape | Dialog closes |
| 73 | Empty query | Clear search text | Results clear |

---

## Phase 3: Reports & Certificates

### 3.1 — Certificate of Disposition

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 74 | Reports hub | Navigate to `/reports` | 4 report cards shown. All marked ready. |
| 75 | Quick search | Type `99001` in transaction search on reports hub | Resolves to T20260215.99001. Quick-nav buttons appear. |
| 76 | Generate disposition | Click Disposition card → select transaction T20260215.99001 | Certificate renders: Logista logo, client name (Baptist Memorial), address, certification text, table with 10 assets |
| 77 | Print | Click "Print" | Browser print dialog opens. Report formatted for A4. Action buttons hidden in print. |
| 78 | CSV download | Click "Download CSV" | CSV file downloads with asset data |
| 79 | No assets | Select a transaction with 0 assets (if any) | Shows "No assets found for this transaction" |

### 3.2 — Certificate of Sanitization

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 80 | Generate sanitization | Select transaction T20260215.99001 | Certificate shows only assets with sanitization data (b...06 and b...07 with wipe). Drive serials listed. NIST 800-88 text. |
| 81 | Drive-level detail | Verify drive serial numbers appear | WD-WMC1T0123456, S5Y1NX0T123456 shown with sanitization method |
| 82 | CSV export | Click "Download CSV" | One row per drive in CSV |

### 3.3 — Reports Hub Features

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 83 | Recent reports | After generating a report, go back to `/reports` | "Recent Reports" section shows the transaction you just viewed |
| 84 | Quick links | Click a recent report entry | Navigates to the correct certificate with ?txn= param |

### 3.4 — Certificate of Data Destruction

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 85 | Generate destruction cert | First, crush the Gulf Coast drives (b...31 drive WD-WMC2T0111111, b...32 drive CT250MX500-22222) via HD Crush workflow. Then select transaction T20260225.99004 | Certificate shows crushed drives with serial numbers and crush dates. Footer: "Total drives destroyed: 2" |
| 86 | No crushed drives | Select a transaction with no crushed drives | "No destroyed drives found" message |

### 3.5 — Certificate of Recycling

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 87 | Generate recycling cert | Select transaction T20260226.99005 (Whitfield Foods) | Certificate shows the recycled Lexmark printer (b...42). Weight column shown. |
| 88 | Weight totals | Verify footer | "Total weight: X lbs" (or 0 if no weight set) |
| 89 | No recycled assets | Select a transaction with no recycled assets | "No recycled assets found" message |

---

## Phase 4: Admin, Dashboard, UX, Inventory

### 4.1 — Dashboard

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 90 | Dashboard loads | Navigate to `/` | Welcome message with user name |
| 91 | Stat cards | Verify 6 cards | Total Assets (72+), Received This Week (varies), Received This Month (varies), Pending Sanitization (count), Available for Sale (5), In Inventory (sum of qty) |
| 92 | Status breakdown | Verify status card | Each status with count and color-coded badge |
| 93 | Type breakdown | Verify type card | Each asset type with count, sorted by volume |
| 94 | Quick actions | Click "New Transaction" | Navigates to `/transactions/new` |
| 95 | Recent transactions | Verify table | Last 10 transactions with date, number, customer, asset count |
| 96 | Top customers | Verify list | Top 5 customers by asset volume |
| 97 | Inventory by status | Verify inventory card | Shows available/in_process/etc with qty totals |
| 98 | Recent activity | Verify journal card | Last 5 journal entries with movement type badges |

### 4.2 — Admin Panel

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 99 | Admin page loads | Navigate to `/admin` | 4-tab panel: Users, Routing Rules, Field Definitions, Buyers |
| 100 | Create user | Users tab → "Create User". Email: `test@logista.com`, Name: `Test User`, Password: `TestPass123!`, Role: `operator`. Submit. | Toast: "User created". User appears in list. |
| 101 | Toggle user | Click deactivate toggle on test user | Toast: "User deactivated" |
| 102 | Create routing rule | Routing Rules tab → "Create Rule". Name: `Recycle old printers`, Conditions: `{"asset_type": "printer"}`, Action: `recycle`, Priority: `10`. Submit. | Toast: "Rule created". Rule appears in list. |
| 103 | Toggle rule | Click active/inactive toggle | Rule toggled, toast confirms |
| 104 | Create field definition | Field Definitions tab → "Add Field". Asset Type: `desktop`, Field Name: `raid_controller`, Label: `RAID Controller`, Type: `boolean`, Group: `hardware`. Submit. | Toast: "Field created". Field appears in list for desktop type. |
| 105 | Verify dynamic field | Navigate to edit a desktop asset → Hardware tab | New "RAID Controller" boolean field appears |
| 106 | Create buyer | Buyers tab → "Add Buyer". Name: `Refurb Depot LLC`, City: `Atlanta`, State: `GA`, Email: `sales@refurbdepot.com`. Submit. | Toast: "Buyer created" |
| 107 | Non-admin blocked | Log in as operator user (if created) → navigate to `/admin` | Redirected or access denied |

### 4.3 — Performance & UX

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 108 | Loading skeletons | Navigate to `/assets` with slow network (DevTools → throttle) | Skeleton placeholder shown before data loads |
| 109 | Error boundary | Manually cause an error (e.g., corrupt URL param) | Error page shown with "Something went wrong" and "Try again" button |
| 110 | Toast on save | Edit any asset tab, save | Green toast appears bottom-right: "Saved successfully" |
| 111 | Toast on error | Try an invalid operation (e.g., bulk update with no selection) | Red toast with error message |
| 112 | Confirm dialog | Select assets → bulk action → Apply | Confirmation dialog: "Are you sure?" with Cancel/Confirm |
| 113 | Drive remove confirm | Edit asset → Hard Drives tab → click X on a drive | Confirmation dialog before deletion |

### 4.4 — Responsive & Accessibility

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 114 | Tablet viewport | Set browser to 1024px width | All pages render without horizontal overflow. Tables scroll horizontally. Forms stack to 2 columns. |
| 115 | Keyboard navigation | Tab through asset table rows | Rows are focusable. Enter/Space activates row click. |
| 116 | ARIA labels | Inspect icon-only buttons (copy, drive remove, inventory actions) | All have `aria-label` attributes |
| 117 | Color contrast | Inspect status badges | All badge text meets WCAG AA (4.5:1+ contrast) |
| 118 | HD crush typeahead | Tab to search input, type serial | Suggestions have `role="listbox"`, items have `role="option"` |

### 4.5 — Inventory Management

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 119 | Inventory page | Navigate to `/inventory` | Table showing all inventory records (72+ from seed data). Columns: Location, Description, Part #, Linked Asset, Qty, UoM, Status. |
| 120 | Inventory search | Type "RECEIVING" in search, Filter | Shows all items at RECEIVING location |
| 121 | Status filter | Select "in_process", Filter | Only in_process inventory records |
| 122 | Location filter | Select "RECEIVING" from dropdown, Filter | Only RECEIVING location items |
| 123 | Linked asset click | Click an asset ID link | Navigates to `/assets/{id}` |
| 124 | Transfer stock | Click `•••` on any row → Transfer. Destination: `SHELF-A1`, Qty: `1`, Reason: `Moved to shelf`. Submit. | Toast: "Stock transferred". New record at SHELF-A1 appears. Source qty decremented. |
| 125 | Transfer validation | Try transferring more than on-hand qty | Error: "Cannot transfer X — only Y on hand" |
| 126 | Transfer same location | Try transferring to the same location | Error: "Destination must differ from current location" |
| 127 | Adjust stock | Click `•••` → Adjust Quantity. New Qty: `0`, Reason: `Physical count correction`. Submit. | Toast: "Stock adjusted". Qty shows 0. |
| 128 | Adjust without reason | Try adjusting without a reason | Error: "Reason is required" |
| 129 | Split batch | Find the bulk cable lot (qty 25). Click `•••` → Split Batch. Row 1: Qty 15, Location: `BIN-A`. Row 2: Qty 10, Location: `BIN-B`. Submit. | Toast: "Batch split". Source qty reduced by 25. Two new records appear at BIN-A (15) and BIN-B (10). |
| 130 | Split exceeds qty | Try splitting more than on-hand | Error: "Split total exceeds quantity on hand" |
| 131 | Journal page | Click "View Journal" button | `/inventory/journal` loads with all journal entries |
| 132 | Journal entries visible | Verify transfer/adjust/split from above | New entries appear: transfer (blue), reversal (slate) + correction (amber) for adjust, split (purple) |
| 133 | Journal type filter | Select "transfer" from Movement Type dropdown | Only transfer entries shown |
| 134 | Journal date filter | Set From/To dates | Only entries in range shown |
| 135 | Qty color coding | Verify journal entries | Positive quantities green with "+", negative red |
| 136 | Performed by | Verify "Performed By" column | Shows user's full name (from user_profiles join) |
| 137 | Pagination | Verify page controls work | Correct page navigation |

---

## Phase 5.1: Production Hardening

### Security Headers

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 138 | Verify headers | Open DevTools → Network → any page request → Response Headers | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `Strict-Transport-Security` present |

### Auth Guards

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 139 | Search API auth | In browser: `http://localhost:3000/api/search?q=test` (while logged out) | 401 Unauthorized |
| 140 | Export API auth | In browser: `http://localhost:3000/api/export` (while logged out) | 401 Unauthorized |

### Open Redirect Prevention

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 141 | Safe redirect | `/callback?code=fake&next=/assets` | Redirects to `/login` (code is fake, but `next` is validated as relative) |
| 142 | Malicious redirect | `/callback?code=fake&next=//evil.com` | Does NOT redirect to evil.com. Redirects to `/login` with `next=/` |
| 143 | Protocol redirect | `/callback?code=fake&next=https://evil.com` | Does NOT redirect externally. Falls through to `/` |

### LIKE Injection Prevention

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 144 | Special chars in search | On `/assets`, search for `%test%` | Returns only assets literally containing "%test%", not all assets |
| 145 | Underscore in search | Search for `_` on `/clients` | Does not match every single-character value. Treated literally. |

---

## Volume Test (500+ Assets)

> Run `scripts/seed-volume-test.sql` in Supabase SQL Editor first.

| # | Test | Steps | Expected |
|---|------|-------|----------|
| 146 | Dashboard loads | Navigate to `/` | Dashboard loads without timeout. Stat cards show 500+ total assets. |
| 147 | Asset list performance | Navigate to `/assets` | Page loads in < 3 seconds. Shows "500+ total assets". Pagination works. |
| 148 | Filter with volume | Apply Type: `desktop` filter | Filtered results load quickly. Count accurate. |
| 149 | Sort with volume | Sort by Status column | Sorts correctly across all 500+ records |
| 150 | CSV export volume | Export CSV | File downloads with 500+ rows. Opens correctly in spreadsheet app. |
| 151 | Search performance | Cmd+K → type "Dell" | Results appear within 1 second |
| 152 | Inventory volume | Navigate to `/inventory` | 500+ records load with pagination |
| 153 | Journal volume | Navigate to `/inventory/journal` | 500+ receipt entries load with pagination |
| 154 | Reports with volume | Generate disposition cert for a large transaction | Report renders correctly with many asset rows |

---

## Quick Smoke Test Checklist

For a fast reverification (15 minutes), run these critical path tests:

- [ ] Login works (test #2)
- [ ] Dashboard shows data (test #90)
- [ ] Create a client (test #12)
- [ ] Create a transaction (test #19)
- [ ] Intake an asset (test #23)
- [ ] Asset list with filters (test #40, #42)
- [ ] Asset detail view (test #55)
- [ ] Edit an asset tab (test #30)
- [ ] HD Crush a drive (test #63)
- [ ] Generate disposition certificate (test #76)
- [ ] Cmd+K search (test #67)
- [ ] Inventory transfer (test #124)
- [ ] Journal shows entries (test #132)
- [ ] Admin panel loads (test #99)
- [ ] Security headers present (test #138)
