# DispoTrack — Phase 7 Tester Checklist

Hi Amber,

I just finished the changes from your 5/18 list. Everything is in the live app and passes our automated tests, but I'd like you to walk through it with real-world eyes before we call it done.

Should take about 20–30 minutes. Numbered checks below grouped by area — feel free to skip any that don't make sense for your workflow.

## What's new

1. **Clients** — one Account # can now have multiple locations
2. **Manufacturer dropdown** — pick from a list of 126, or type a one-off
3. **Tablet** — new asset type that mirrors Laptop (minus optical drive)
4. **New fields** — Monitor CRT/LCD, Laptop screen-program checkbox, Description on intake for Other/Network
5. **Reset Form button** — quick way to blank everything on intake

---

## Section 1 — Multi-location clients

### 1a. Existing clients still look right
- Go to **Clients** → pick any existing client (e.g., Baptist Memorial).
- The new **Locations** section should show one location marked "Primary" with the same address that was previously on the client.
- ✅ Confirm: the address is the one you'd expect to see, no missing data.

### 1b. Add a second location
- Same client → click **Add Location**.
- Fill in: Name = "Test Branch", any address, any contact.
- Click **Add Location** in the dialog. Should see toast and the new location in the list.

### 1c. Mark the new location as primary
- Click the star icon (⭐) next to "Test Branch".
- The Primary badge should move to Test Branch; the original location loses it.

### 1d. Primary location can't be deleted
- Try clicking delete (🗑) on the now-primary "Test Branch".
- The trash icon should NOT be there at all (the UI hides it for the primary). Cleanup tip: mark another one primary first, then you can delete.

### 1e. Transactions ask for a location
- **Transactions** → **New Transaction** → pick a client.
- A **Location** dropdown should appear right below Client (required). It defaults to the client's primary.
- Pick a non-primary location, fill in the rest, save.

### 1f. Certificate prints the LOCATION address (not HQ)
- Open the transaction you just created → **Print Sheet**. The address shown should be the non-primary location's address.
- Same for **Reports** → **Disposition Certificate** for that transaction.

---

## Section 2 — Manufacturer dropdown

### 2a. Pick a seeded manufacturer at intake
- **Assets** → **Intake** → pick any transaction → Asset Type = Desktop.
- Click the **Manufacturer** field. A list of 126 manufacturers should appear.
- Type "del" — Dell should show. Click it. The button should now show "Dell".
- Submit. Verify the asset saved with Dell.

### 2b. Type a one-off manufacturer
- Same intake form. Click Manufacturer, type something not in the list (e.g., "Acme Bizarre Vendor").
- A "Use 'Acme Bizarre Vendor' as a one-off" item should appear. Click it.
- Submit. The asset is saved with that exact text — but the master manufacturer list does NOT grow (this prevents the Dell/DELL/dell duplication problem you mentioned).

### 2c. Admin can manage the manufacturer list
- **Admin** → **Manufacturers** tab.
- Use the search box ("test").
- Click **Add Manufacturer**. Add "Test Vendor" with sort order 0. Save.
- Toggle the Active switch off on Test Vendor. Go back to **Intake**, open the Manufacturer dropdown — Test Vendor should NOT appear in the list (active toggle hides it).
- Toggle back on, then delete Test Vendor (confirmation appears).

### 2d. Duplicate name rejected
- **Admin** → **Manufacturers** → Add Manufacturer with name "Dell".
- Should see an error: "A manufacturer named 'Dell' already exists."

---

## Section 3 — Tablet asset type

### 3a. Create a tablet
- **Assets** → **Intake** → Asset Type dropdown.
- "Tablet" should appear between Laptop and Monitor.
- Pick it, fill in Manufacturer = Apple, Model = "iPad Pro M2". Submit.

### 3b. Edit form for tablet
- Open the new tablet asset → **Edit**.
- **Hardware tab**: should show CPU, Total Memory, Color — but **NO Optical Drive**, **NO Hard Drives section**.
- **Type-Specific tab**: should show 7 fields — Battery, Battery Held 30min, Webcam, Screen Size, Screen Condition, Keyboard Works, AC Adapter. **Should NOT show "Laptop Screen Program Ran Successfully"** (that's laptops only).

---

## Section 4 — New fields on existing types

### 4a. Monitor display type (CRT/LCD)
- Open any monitor asset → **Edit** → **Type-Specific tab**.
- First field should be **Display Type** with options CRT / LCD.
- Pick LCD, Save. Reload — value persists.

### 4b. Laptop screen-program checkbox
- Open any laptop asset → **Edit** → **Type-Specific tab**.
- A new "Laptop Screen Program Ran Successfully" checkbox should appear at the bottom of the list (after AC Adapter).
- Toggle, Save, Reload — value persists.

### 4c. Description on intake for Other and Network
- **Intake** form. Pick a transaction. Asset Type = **Other**.
- A **Description** textarea should appear above Notes with a placeholder like "What is this asset?"
- Type "Card scanner for badge issuance". Submit.
- Open the new asset → **Edit** → **Type-Specific tab** → Description field should show what you typed.
- Repeat for Asset Type = **Network** (different placeholder).
- Pick Desktop or Laptop or any other type — Description should NOT appear (it's only for Other/Network at intake).

---

## Section 5 — Reset Form button

### 5a. Button is visible
- **Intake** → see a new **Reset Form** button next to **Add Asset**.

### 5b. Empty form → silent reset
- Fresh page load. Click **Reset Form** → nothing happens (no popup, no toast — form is already empty).

### 5c. Dirty form → confirmation
- Pick a transaction, set Type = Desktop, fill manufacturer + model.
- Click **Reset Form** → a confirmation popup appears: "Clear all fields?"
- Click **Cancel** → popup closes, all your fields are intact.
- Click **Reset Form** again → **Clear Form** → everything blanks, including the transaction.

### 5d. Quick-add still works
- Pick transaction, set Type = Desktop, Mfg = Dell, Model = OptiPlex. Submit.
- Confirm: serial number and asset tag cleared, but transaction + Desktop + Dell + OptiPlex are still filled in (this is the batch-entry shortcut from earlier).

---

## Section 6 — Quick regression eyeball (5 minutes)

Just open these pages and confirm nothing looks broken:

- [ ] **Dashboard** — stat cards render, recent transactions list shows up, no error
- [ ] **Assets** list — filter by type, filter by client (Location filter should appear after client picked), pagination works
- [ ] **Reports** → **Assets Sold** report — date-range picker works, table renders
- [ ] **HD Crush** — typeahead by serial still finds drives (try one you know exists)
- [ ] **Inventory** — Stock on hand page loads, journal page loads
- [ ] **Cmd+K** (global search) — search a client name, a transaction number, an asset serial — all work

---

## How to report issues

If anything doesn't behave as described, screenshot or copy/paste the URL and tell me:
1. What page you were on
2. What you clicked
3. What you expected
4. What happened instead

Quickest way to me — text or email back.

Thanks for testing!
Drayton
