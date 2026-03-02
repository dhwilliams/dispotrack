# DispoTrack Database Schema (v2)

> **Note:** This document reflects the v2 target schema. The currently deployed database is v1 (Phase 0.2). See TODO.md Phase 0.2b for the migration plan.

### Overview

DispoTrack uses a PostgreSQL database (hosted on Supabase) to track IT asset disposition — from customer receipt through testing, grading, sanitization, and final disposition (resale or recycle). The v2 schema separates asset lifecycle tracking from inventory management (Sage STOCK/STOJOU pattern), supports drive-level sanitization, admin-configurable field definitions, revenue sharing, and bulk tracking.

---

### Entity Relationship Diagram (Text)

```
clients (1) ──────< transactions (1) ──────< assets (1) ──┬──< asset_hard_drives (drive-level sanitization)
   │                                                       ├──── asset_grading (1:1)
   │                                                       ├──── asset_type_details (1:1, JSONB — hardware + type-specific)
   │                                                       ├──── asset_sanitization (1:1, device-level)
   │                                                       ├──── asset_sales (1:1) ──── buyers (M:1, optional)
   │                                                       ├──< asset_status_history
   │                                                       ├──< inventory (1:M — position per location)
   │                                                       └──── asset_settlement (1:M) ──── client_revenue_terms
   │
   └──< client_revenue_terms (versioned)

inventory (1) ──────< inventory_journal (append-only ledger)

asset_type_field_definitions (admin-configurable, per asset type)
routing_rules (admin-configurable, evaluated at triage)
buyers (normalized repeat buyer info)

auth.users (1) ──── user_profiles (1:1)
```

---

### Tables

#### 1. `clients`
Customers whose equipment we receive and process.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| account_number | TEXT | UNIQUE, NOT NULL | Customer account identifier |
| name | TEXT | NOT NULL | Customer/company name |
| cost_center | TEXT | nullable | Customer cost center code |
| address1, address2 | TEXT | nullable | Street address |
| city, state, zip | TEXT | nullable | Location |
| contact_name | TEXT | nullable | Primary contact |
| contact_email | TEXT | nullable | |
| contact_phone | TEXT | nullable | |
| external_reference_id | TEXT | nullable | Sage integration |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 2. `transactions`
Incoming batches of equipment tied to Auto-Test ticket numbers. Each transaction belongs to one client and contains one or more assets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| transaction_number | TEXT | UNIQUE, NOT NULL | Format: `T20260226.00001` |
| transaction_date | DATE | NOT NULL | Date equipment was received |
| client_id | UUID | FK → clients.id, NOT NULL | |
| special_instructions | TEXT | nullable | Customer-specific handling notes |
| created_by | UUID | FK → auth.users.id, nullable | User who created the record |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 3. `assets`
Identity + lifecycle record for equipment. Persists forever — even after the physical item leaves. Central table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| internal_asset_id | TEXT | UNIQUE, NOT NULL | Auto-generated (e.g., "LR3-000001") |
| serial_generated | BOOLEAN | NOT NULL, default false | True if serial was auto-assigned |
| transaction_id | UUID | FK → transactions.id, NOT NULL | |
| serial_number | TEXT | **nullable** | Device serial number (optional at intake) |
| asset_type | TEXT | NOT NULL, CHECK | One of: `desktop`, `server`, `laptop`, `monitor`, `printer`, `phone`, `tv`, `network`, `other` |
| tracking_mode | TEXT | NOT NULL, CHECK, default 'serialized' | `serialized` or `bulk` |
| manufacturer | TEXT | nullable | e.g., Dell, HP, Lenovo |
| model | TEXT | nullable | Model number |
| model_name | TEXT | nullable | Model marketing name |
| mfg_part_number | TEXT | nullable | Manufacturer part number |
| asset_tag | TEXT | nullable | Customer's internal asset tag |
| quantity | INTEGER | NOT NULL, default 1 | 1 for serialized, N for bulk |
| unit_of_measure | TEXT | default 'EA' | e.g., EA, LB, BOX |
| weight | NUMERIC(10,2) | nullable | lbs, for recycling/shipping |
| notes | TEXT | nullable | |
| bin_location | TEXT | nullable | Warehouse bin/shelf location |
| asset_destination | TEXT | CHECK, default 'pending' | One of: `external_reuse`, `recycle`, `internal_reuse`, `pending` |
| available_for_sale | BOOLEAN | NOT NULL, default false | |
| status | TEXT | NOT NULL, CHECK, default 'received' | See lifecycle below |
| external_reference_id | TEXT | nullable | Sage integration |
| created_by | UUID | FK → auth.users.id, nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

**Asset Status Lifecycle:**
```
received → in_process → tested → graded → sanitized → available → sold
                                                                  → recycled
                                                       on_hold (any stage)
```

**internal_asset_id** is auto-generated by a database trigger on insert (format: `LR3-000001`, `LR3-000002`, ...).

---

#### 4. `asset_hard_drives`
Normalized hard drive records with **drive-level sanitization**. The legacy system stored 24 hard drive columns per asset — this schema normalizes them into rows with per-drive sanitization tracking.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, NOT NULL | |
| drive_number | INTEGER | NOT NULL | Drive slot number (1, 2, 3...) |
| serial_number | TEXT | nullable | Drive serial number |
| manufacturer | TEXT | nullable | Drive manufacturer |
| size | TEXT | nullable | e.g., "256GB", "1TB" |
| sanitization_method | TEXT | CHECK, nullable | `wipe`, `destruct_shred`, `clear_overwrite`, `none` |
| sanitization_details | TEXT | nullable | Additional notes |
| wipe_verification_method | TEXT | nullable | How wipe was verified |
| sanitization_validation | TEXT | nullable | Validation result |
| sanitization_tech | TEXT | nullable | Technician who performed sanitization |
| sanitization_date | DATE | nullable | Date sanitization was performed |
| date_crushed | DATE | nullable | Date the drive was physically destroyed |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

**Unique constraint:** `(asset_id, drive_number)` — one entry per drive slot per asset.

---

#### 5. `asset_grading`
Cosmetic and functional grading results. One-to-one with assets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, UNIQUE | |
| cosmetic_category | TEXT | CHECK, nullable | `C1` (like new) through `C5` (damaged) |
| functioning_category | TEXT | CHECK, nullable | `F1` (fully functional) through `F5` (non-functional) |
| does_unit_power_up | BOOLEAN | nullable | |
| does_unit_function_properly | BOOLEAN | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 6. `asset_type_details`
All type-specific and hardware fields stored as JSONB. **Replaces the old `asset_hardware` table.** Hardware fields (CPU, memory, chassis, optical drive, color) and type-specific fields (battery, toner, etc.) are both stored here. Field structure is defined by `asset_type_field_definitions` (admin-configurable). One-to-one with assets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, UNIQUE | |
| details | JSONB | NOT NULL, default '{}' | Flexible key-value store |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

**Example details for a desktop:**
```json
{
  "cpu_info": [{"type": "Intel Core i5-10505 @ 3.20GHz", "slot": 1}],
  "total_memory": "8192",
  "optical_drive_type": "CD/DVD",
  "chassis_type": "SFF Desktop",
  "color": "Black"
}
```

**Example details for a laptop:**
```json
{
  "cpu_info": [{"type": "Intel Core i7-1165G7 @ 2.80GHz", "slot": 1}],
  "total_memory": "16384",
  "color": "Silver",
  "battery": true,
  "battery_held_30min": true,
  "webcam": true,
  "screen_size": "14",
  "screen_condition": "Good",
  "keyboard_works": true,
  "ac_adapter": true
}
```

---

#### 7. `asset_type_field_definitions`
Admin-configurable field definitions per asset type. Drives dynamic form rendering — when an admin adds a field, it appears in the UI automatically.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_type | TEXT | NOT NULL, CHECK | One of the 9 asset types |
| field_name | TEXT | NOT NULL | JSON key in `asset_type_details.details` |
| field_label | TEXT | NOT NULL | Display label in UI |
| field_type | TEXT | NOT NULL, CHECK | `text`, `number`, `boolean`, `select`, `textarea`, `json_array` |
| field_options | JSONB | nullable | For `select`: array of options; for `json_array`: schema |
| field_group | TEXT | NOT NULL, default 'general' | Tab grouping: `hardware`, `type_specific` |
| is_required | BOOLEAN | NOT NULL, default false | |
| sort_order | INTEGER | NOT NULL, default 0 | Display order within group |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

**Unique constraint:** `(asset_type, field_name)`

See `api-architect.md` for full seed data (all 9 asset types with default fields).

---

#### 8. `asset_sanitization`
Device-level sanitization records. Used for assets without hard drives that need sanitization notes, or device-level summary alongside per-drive records. One-to-one with assets.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, UNIQUE | |
| sanitization_method | TEXT | CHECK, nullable | `wipe`, `destruct_shred`, `clear_overwrite`, `none` |
| sanitization_details | TEXT | nullable | Additional notes |
| wipe_verification_method | TEXT | nullable | How wipe was verified |
| hd_sanitization_validation | TEXT | nullable | Validation result |
| validator_name | TEXT | nullable | Person who validated |
| validation_date | DATE | nullable | |
| inspection_tech | TEXT | nullable | Technician who performed inspection |
| inspection_datetime | TIMESTAMPTZ | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 9. `buyers`
Normalized repeat buyer information. Linked from `asset_sales` via `buyer_id` FK.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| name | TEXT | NOT NULL | Buyer name |
| address1, address2 | TEXT | nullable | |
| city, state, zip, country | TEXT | nullable | |
| contact_name | TEXT | nullable | |
| contact_number | TEXT | nullable | |
| ebay_name | TEXT | nullable | eBay buyer handle |
| email | TEXT | nullable | |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 10. `asset_sales`
Sales and shipment records for assets sold to buyers. One-to-one with assets. Optional `buyer_id` FK for repeat buyers; inline fields for one-off sales.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, UNIQUE | |
| buyer_id | UUID | FK → buyers.id, nullable | Repeat buyer reference |
| logista_so | TEXT | nullable | Logista sales order number |
| customer_po_number | TEXT | nullable | Customer PO |
| sold_to_name | TEXT | nullable | Buyer name (inline, for one-offs) |
| sold_to_address1/2 | TEXT | nullable | |
| sold_to_city/state/zip/country | TEXT | nullable | |
| sold_to_contact_name | TEXT | nullable | |
| sold_to_contact_number | TEXT | nullable | |
| sold_to_ebay_name | TEXT | nullable | eBay buyer handle |
| ebay_item_number | TEXT | nullable | eBay listing ID |
| sale_price | NUMERIC(10,2) | nullable | |
| sold_date | DATE | nullable | |
| shipment_date | DATE | nullable | |
| shipment_carrier | TEXT | nullable | e.g., UPS, FedEx |
| shipment_method | TEXT | nullable | |
| shipment_tracking_number | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 11. `asset_status_history`
Append-only audit trail. Every status change is recorded. No updates or deletes allowed.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, ON DELETE CASCADE, NOT NULL | |
| previous_status | TEXT | nullable | Status before change (null for initial) |
| new_status | TEXT | NOT NULL | Status after change |
| reason_for_change | TEXT | nullable | Why the change was made |
| explanation | TEXT | nullable | Additional context |
| changed_by | UUID | FK → auth.users.id, nullable | User who made the change |
| changed_at | TIMESTAMPTZ | NOT NULL, default now() | |

---

#### 12. `inventory`
Aggregate stock levels at a location. Modeled after Sage STOCK pattern. Answers: what do we have, where is it, how many?

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, nullable | Null for bulk items without asset records |
| part_number | TEXT | nullable | For bulk/unserialized items |
| description | TEXT | nullable | |
| location | TEXT | NOT NULL | Bin/shelf/zone (e.g., "W1-SHELF2-LVL3") |
| quantity_on_hand | NUMERIC(10,2) | NOT NULL, default 0 | |
| unit_of_measure | TEXT | NOT NULL, default 'EA' | |
| status | TEXT | NOT NULL, CHECK, default 'available' | `available`, `reserved`, `in_process`, `quarantine` |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 13. `inventory_journal`
Append-only ledger of all stock movements. Modeled after Sage STOJOU pattern. Nothing moves without a journal entry. Corrections = reversal + new entry, never edits.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| inventory_id | UUID | FK → inventory.id, nullable | |
| asset_id | UUID | FK → assets.id, nullable | |
| transaction_id | UUID | FK → transactions.id, nullable | Source receiving transaction |
| movement_type | TEXT | NOT NULL, CHECK | `receipt`, `issue`, `transfer`, `split`, `correction`, `reversal` |
| quantity | NUMERIC(10,2) | NOT NULL | Positive for in, negative for out |
| from_location | TEXT | nullable | |
| to_location | TEXT | nullable | |
| reference_number | TEXT | nullable | PO, SO, transaction number, etc. |
| reason | TEXT | nullable | |
| performed_by | UUID | FK → auth.users.id, nullable | |
| performed_at | TIMESTAMPTZ | NOT NULL, default now() | |

---

#### 14. `client_revenue_terms`
Client revenue sharing terms, versioned with effective dates.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| client_id | UUID | FK → clients.id, NOT NULL | |
| term_type | TEXT | NOT NULL, CHECK | `flat_fee`, `percentage`, `tiered`, `threshold` |
| term_details | JSONB | NOT NULL | Formula definition per term_type |
| effective_date | DATE | NOT NULL | |
| expiration_date | DATE | nullable | Null = currently active |
| notes | TEXT | nullable | |
| created_by | UUID | FK → auth.users.id, nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 15. `asset_settlement`
Per-sale settlement calculations linked to revenue terms.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| asset_id | UUID | FK → assets.id, NOT NULL | |
| sale_id | UUID | FK → asset_sales.id, NOT NULL | |
| revenue_term_id | UUID | FK → client_revenue_terms.id, NOT NULL | |
| sale_amount | NUMERIC(10,2) | NOT NULL | |
| client_share | NUMERIC(10,2) | NOT NULL | |
| logista_share | NUMERIC(10,2) | NOT NULL | |
| settlement_date | DATE | nullable | |
| settled | BOOLEAN | NOT NULL, default false | |
| notes | TEXT | nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 16. `routing_rules`
Admin-configurable rules engine for auto-suggesting disposition path at triage.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, auto-generated | |
| name | TEXT | NOT NULL | Rule name |
| description | TEXT | nullable | |
| priority | INTEGER | NOT NULL, default 0 | Higher = evaluated first |
| conditions | JSONB | NOT NULL | e.g., `{"asset_type": "monitor", "screen_size_lt": 20}` |
| action | TEXT | NOT NULL, CHECK | `recycle`, `test`, `external_reuse`, `internal_reuse`, `manual_review` |
| is_active | BOOLEAN | NOT NULL, default true | |
| created_by | UUID | FK → auth.users.id, nullable | |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

#### 17. `user_profiles`
Application user accounts with role-based access. Auto-created when a user is added to Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PK, FK → auth.users.id, ON DELETE CASCADE | |
| email | TEXT | NOT NULL | |
| full_name | TEXT | nullable | |
| role | TEXT | NOT NULL, CHECK, default 'operator' | `admin`, `operator`, `viewer`, `receiving_tech`, `client_portal_user` |
| created_at | TIMESTAMPTZ | NOT NULL, default now() | |
| updated_at | TIMESTAMPTZ | NOT NULL, auto-updated | |

---

### Indexes

| Index | Table | Column(s) | Notes |
|-------|-------|-----------|-------|
| idx_assets_internal_id | assets | internal_asset_id | Primary lookup (auto-generated) |
| idx_assets_serial | assets | serial_number | Serial lookup |
| idx_assets_transaction | assets | transaction_id | Join performance |
| idx_assets_type | assets | asset_type | Filter by type |
| idx_assets_status | assets | status | Filter by status |
| idx_assets_destination | assets | asset_destination | Filter by disposition |
| idx_assets_manufacturer | assets | manufacturer | Filter by mfg |
| idx_assets_tracking_mode | assets | tracking_mode | Filter serialized vs bulk |
| idx_transactions_number | transactions | transaction_number | Primary lookup |
| idx_transactions_client | transactions | client_id | Join performance |
| idx_transactions_date | transactions | transaction_date | Date range queries |
| idx_clients_account | clients | account_number | Primary lookup |
| idx_clients_name | clients | name | Search by name |
| idx_hard_drives_serial | asset_hard_drives | serial_number | HD crush workflow lookup |
| idx_hard_drives_asset | asset_hard_drives | asset_id | Join performance |
| idx_status_history_asset | asset_status_history | asset_id | History lookup |
| idx_status_history_date | asset_status_history | changed_at | Date range queries |
| idx_inventory_asset | inventory | asset_id | Join performance |
| idx_inventory_location | inventory | location | Location queries |
| idx_inventory_part | inventory | part_number | Part lookup |
| idx_inventory_status | inventory | status | Filter by status |
| idx_journal_inventory | inventory_journal | inventory_id | Join performance |
| idx_journal_asset | inventory_journal | asset_id | Join performance |
| idx_journal_transaction | inventory_journal | transaction_id | Join performance |
| idx_journal_type | inventory_journal | movement_type | Filter by type |
| idx_journal_date | inventory_journal | performed_at | Date range queries |
| idx_revenue_terms_client | client_revenue_terms | client_id | Client lookup |
| idx_revenue_terms_effective | client_revenue_terms | effective_date | Date queries |
| idx_settlement_asset | asset_settlement | asset_id | Asset lookup |
| idx_settlement_sale | asset_settlement | sale_id | Sale lookup |
| idx_buyers_name | buyers | name | Search by name |
| idx_buyers_ebay | buyers | ebay_name | eBay lookup |
| idx_sales_buyer | asset_sales | buyer_id | Join performance |
| idx_routing_rules_active | routing_rules | is_active, priority DESC | Rule evaluation order |
| idx_field_defs_type | asset_type_field_definitions | asset_type | Lookup by type |

---

### Access Control (Row Level Security)

| Role | Read | Insert/Update | Delete | Notes |
|------|------|---------------|--------|-------|
| **viewer** | All tables (except client-portal-restricted) | None | None | |
| **operator** | All tables (except client-portal-restricted) | Assets, transactions, clients, hard drives, grading, type details, sanitization, sales, inventory, journal, buyers | None | |
| **receiving_tech** | All tables (except client-portal-restricted) | Transactions, assets (insert only) | None | Intake-focused |
| **admin** | All tables | All tables | All tables | Full access |
| **client_portal_user** | Own client's assets/transactions only | None | None | External, restricted |

- `asset_status_history` is **append-only** — no updates or deletes for any role
- `inventory_journal` is **append-only** — no updates or deletes for any role
- `user_profiles` — users can read their own profile; admins can read/write all
- `routing_rules` and `asset_type_field_definitions` — admins can write; all authenticated can read
- Three helper functions enforce policies: `get_user_role()`, `is_admin()`, `is_operator_or_admin()`

---

### Automatic Behaviors

1. **internal_asset_id trigger** — Automatically generates `internal_asset_id` (format: `LR3-000001`) on INSERT when null
2. **updated_at trigger** — Automatically sets `updated_at = now()` on every UPDATE for all tables that have the column
3. **User profile auto-creation** — When a user is added to Supabase Auth, a `user_profiles` row is automatically inserted with their email and default role (`operator`)
4. **Cascade deletes** — Deleting an asset automatically removes its hard drives, grading, type details, sanitization, sales, and status history records

---

### Removed Tables (v1 → v2)

| Table | Replacement | Notes |
|-------|-------------|-------|
| `asset_hardware` | `asset_type_details` (JSONB) | CPU, memory, chassis, optical drive, color merged into details JSON. Field structure defined by `asset_type_field_definitions`. Migration copies data before drop. |
