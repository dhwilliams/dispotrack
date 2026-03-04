# Depot-Ready Architecture — Design Decisions

> Record of architectural discussions between development, systems analyst, and business stakeholders regarding the separation of asset tracking and inventory management. These decisions inform the DispoTrack schema and should be referenced for any future Depot integration work.

---

## Core Principle: Assets ≠ Inventory

**Assets** and **Inventory** serve fundamentally different purposes and must be modeled separately.

- **Asset**: A record of identity and lifecycle information about a specific item. An asset record persists forever — even after the physical item is sold, recycled, destroyed, or no longer in our possession. Assets have dispositions (deployed to customer, recycled, sold). Assets power certificates, audit trails, grading history, and compliance reporting.

- **Inventory**: A record of physical goods currently in our control. Inventory answers: what do we have, where is it, and how many? When an item leaves the warehouse, the inventory record closes. Inventory is about current warehouse reality.

**Why this matters:**
- LR3 is asset-heavy: every serialized device needs full lifecycle tracking, certificates, sanitization records.
- Depot is inventory-heavy: warehouse stock management, bin locations, quantities on hand. Asset-level tracking is needed only sometimes.
- A system that conflates the two will fail one business or the other. Separating them at the data layer means both can be served from the same platform.

**Current pain point (from analyst):** Depot currently has inventory tracking but no asset tracking. LR3 (via Caspio) has asset tracking but no real inventory management. This system should solve both.

---

## Data Model Pattern (Sage Reference)

The analyst provided a reference model based on Sage ERP's proven pattern:

| Sage Table | DispoTrack Equivalent | Purpose |
|------------|----------------------|---------|
| STOCK | `inventory` | Aggregate stock levels — qty on hand at a location |
| STOJOU | `inventory_journal` | Stock movement ledger — every receive, issue, transfer, split, correction |
| STOSER | `assets` | Per-unit identity — serial numbers, specs, grades, lifecycle details |

### Example: Receiving 50 Serialized Items

**inventory** gets one row:
```
qty: 50, part: "ABC", location: "W1-SHELF2-LVL3"
```

**inventory_journal** gets 50 rows (one per serial):
```
qty: 1, part: "ABC", location: "W1-SHELF2-LVL3", serial: "AAAAA", receipt: "T20260301.00001"
qty: 1, part: "ABC", location: "W1-SHELF2-LVL3", serial: "AAAAB", receipt: "T20260301.00001"
... (48 more)
```

**assets** gets 50 rows:
```
qty: 1, part: "ABC", serial: "AAAAA", owner: "Client X", grade: null, details: {...}
... (49 more)
```

### Example: Batch Split at Grading (Bulk/Unserialized)

50 ungraded keyboards arrive. After grading:

**inventory_journal** entries:
```
-50  Keyboards, ungraded, Bin A3     (issue out)
+26  Keyboards, Grade C2, Bin B1    (receive in)
+13  Keyboards, Grade C3, Bin B2    (receive in)
+11  Keyboards, Grade C5, Bin R1    (receive in — recycle staging)
```

The journal always balances. Full traceability without self-referencing asset records.

---

## Key Architectural Rules

1. **Nothing moves without a journal entry.** Every stock movement (receive, issue, transfer, split, correction) produces a journal row. This is the audit trail for physical goods.

2. **Corrections are reversals, not edits.** To fix a mistake, you don't update the journal entry — you create a reversal entry (negative) and a new correct entry (positive). Two rows. This is how you answer historical questions and pass audits.

3. **The journal is the source of truth for history.** If someone asks "what happened to those 50 keyboards?", the journal tells the complete story. No reconstructing state from edited records.

4. **Reports query what they need, nothing more.** Asset reporting doesn't touch inventory. Inventory reporting doesn't touch assets. When you need both, it's a simple join. Narrow tables = fast queries.

5. **Transactions are inventory receipts.** The existing `transactions` table (LR3's batch intake records) maps directly to the receipt concept. Each transaction is a receiving event that creates inventory and (for serialized items) asset records.

---

## Bulk vs. Serialized Tracking

| Aspect | Serialized | Bulk |
|--------|-----------|------|
| Asset record | One per unit | None (or one per batch for reporting) |
| Inventory record | Links to asset via asset_id | Standalone with quantity |
| Journal entries | Per-unit (qty: 1 each) | Per-batch (qty: N) |
| Grading | Per-unit | Batch split via journal (issue + receive) |
| Sanitization | Per-unit/per-drive | Batch-level |
| Certificates | Per-unit serial numbers | Counts and weights |

---

## Label Printing Clarification

**Business owner directive:** Label printing is optional, never required or prompted.

- `internal_asset_id` assignment is a data management function that happens automatically at record creation
- Printing a physical label with barcode/QR is an available action button, not a workflow step
- The system never gates progress on whether a label was printed
- Not every unserialized batch needs physical labels just because the system assigned an internal tracking ID

---

## Merging asset_hardware into asset_type_details

**Analyst recommendation (approved):** Eliminate the `asset_hardware` table. Merge CPU, memory, chassis, optical drive, color into the JSONB approach in `asset_type_details`.

Add an `asset_type_field_definitions` table so administrators can define which fields exist, which are required vs optional, and what data types they accept — per asset type. This makes the system extensible without code changes.

**Tradeoff acknowledged:** JSONB fields complicate reporting since details must be extracted from JSON. The field definitions table serves as the map for reporting queries. This is the right tradeoff for extensibility, especially with Depot expansion planned.

---

## Drive-Level Sanitization

**Requirement:** Sanitization tracking must be per-drive, not per-device. A server with 4 drives may have drives wiped on different dates by different methods.

- Sanitization fields added directly to `asset_hard_drives`
- `asset_sanitization` remains for device-level notes on non-storage assets
- Certificates pull from both tables depending on whether drives exist

---

## Revenue Share & Settlement

New tables required for client profit-sharing agreements:
- `client_revenue_terms` — versioned with effective/expiration dates, supports threshold-based, flat-fee, and tiered formulas
- `asset_settlement` — per-sale calculation linked to the terms in effect at time of sale
- Must be auditable: every settlement traceable to the specific revenue terms record applied

---

## Buyers / Repeat Vendor Tracking

Normalize repeat buyer information out of `asset_sales` into a dedicated `buyers` table. Link via `buyer_id` FK. Keep inline fields on `asset_sales` nullable for one-time or anonymous buyers.

---

## Future Considerations

- **Sage Integration**: `external_reference_id` fields on clients and assets are already in place. Inventory journal format is compatible with Sage's STOJOU pattern.
- **Depot Expansion**: The asset/inventory separation means Depot can use inventory management immediately without needing full asset lifecycle workflows.
- **Client Portal**: Separate auth, read-only access to their own assets/certificates/settlements.
- **CMMC 2.0**: Append-only audit trails and user attribution on all mutations already align with CMMC requirements.

---

## Document History

| Date | Notes |
|------|-------|
| 2026-03-02 | Initial design discussion — analyst, business owner, development |
