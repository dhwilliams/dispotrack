-- DispoTrack — Volume Test Seed Data (500+ Assets)
-- Run in Supabase SQL Editor AFTER running seed-clients.sql and seed-transactions-assets.sql
--
-- Creates 25 additional transactions and ~525 assets for performance/volume testing.
-- Uses 'c' prefix transaction UUIDs and .98xxx sequence numbers to avoid conflicts
-- with existing seed data (.99xxx) and app-created data.
--
-- Idempotent — safe to re-run (cleanup section removes previous volume test data).
--
-- Expected record counts:
--   25 transactions
--   525 assets (mix of all 9 types, all statuses, serialized + bulk)
--   525 inventory records
--   525+ journal entries
--   ~1800 status history entries
--   ~60 hard drive records
--   ~130 grading records
--   ~65 sanitization records

-- ============================================================================
-- CLEANUP (idempotent — removes previous volume test data)
-- ============================================================================

DO $cleanup$
BEGIN
  DELETE FROM inventory_journal WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM inventory WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_status_history WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_sanitization WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_grading WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_hard_drives WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_sales WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM asset_type_details WHERE asset_id IN (
    SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
  );
  DELETE FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%';
  DELETE FROM transactions WHERE id::text LIKE 'c0000001-0001-4000-8000-0000000000%';
  RAISE NOTICE 'Volume test cleanup complete';
END $cleanup$;

-- ============================================================================
-- GENERATE TRANSACTIONS (25) AND ASSETS (~525)
-- ============================================================================

DO $generate$
DECLARE
  v_txn_id UUID;
  v_txn_number TEXT;
  v_txn_date DATE;
  v_client_id UUID;
  v_asset_id UUID;
  v_inv_id UUID;
  v_asset_type TEXT;
  v_status TEXT;
  v_manufacturer TEXT;
  v_model TEXT;
  v_serial TEXT;
  v_asset_tag TEXT;
  v_tracking_mode TEXT;
  v_quantity INTEGER;
  v_weight NUMERIC(10,2);
  v_destination TEXT;
  v_available BOOLEAN;
  v_notes TEXT;
  v_location TEXT;
  v_inv_status TEXT;
  v_inv_desc TEXT;
  v_asset_counter INTEGER := 0;
  v_mfg_idx INTEGER;
  v_type_idx INTEGER;
  v_status_idx INTEGER;
  v_num_drives INTEGER;

  -- Client account numbers (must match seed-clients.sql)
  v_accounts TEXT[] := ARRAY[
    'BA0400','NR0500','CS0600','PV0700','WH0800',
    'AT0900','GC1000','DM1100','SR1200','LX1300'
  ];

  v_instructions TEXT[] := ARRAY[
    'Standard processing.',
    'Priority — customer audit pending.',
    'HIPAA wipe required on all storage devices.',
    'PCI compliance — drives must be physically destroyed.',
    NULL,
    'Bulk lot — verify quantities against manifest.',
    'Expedite — customer needs certificate ASAP.',
    NULL,
    'Rack-mount equipment — handle with care.',
    'Student devices — full wipe certification required.'
  ];

  -- Asset type pool (weighted: more desktops/laptops)
  v_types TEXT[] := ARRAY[
    'desktop','desktop','desktop','desktop',
    'laptop','laptop','laptop','laptop',
    'server','server',
    'monitor','monitor','monitor',
    'printer','printer',
    'phone','phone',
    'network',
    'tv',
    'other'
  ];

  -- Status pool (weighted: more early-stage)
  v_statuses TEXT[] := ARRAY[
    'received','received','received','received','received',
    'in_process','in_process','in_process','in_process',
    'tested','tested','tested',
    'graded','graded',
    'sanitized','sanitized',
    'available','available',
    'sold',
    'recycled',
    'on_hold'
  ];

  -- Manufacturer/model pairs per type
  v_desk_m TEXT[] := ARRAY['HP','Dell','Lenovo','HP','Dell','Lenovo'];
  v_desk_d TEXT[] := ARRAY['ProDesk 400 G7','OptiPlex 7090','ThinkCentre M920q','EliteDesk 800 G6','OptiPlex 5090','ThinkCentre M75q'];
  v_lap_m  TEXT[] := ARRAY['Dell','HP','Lenovo','Dell','HP','Dell'];
  v_lap_d  TEXT[] := ARRAY['Latitude 5530','EliteBook 840 G8','ThinkPad T14s','Latitude 7430','ProBook 450 G9','Latitude 3520'];
  v_srv_m  TEXT[] := ARRAY['Dell','HP','Dell','HP'];
  v_srv_d  TEXT[] := ARRAY['PowerEdge R750','ProLiant DL380 Gen10','PowerEdge R640','ProLiant DL360 Gen10'];
  v_mon_m  TEXT[] := ARRAY['Dell','HP','LG','Samsung','Dell'];
  v_mon_d  TEXT[] := ARRAY['P2422H','E243','27BN88U-B','S24A400','U2422H'];
  v_prt_m  TEXT[] := ARRAY['HP','Brother','Lexmark','HP'];
  v_prt_d  TEXT[] := ARRAY['LaserJet Pro M404dn','HL-L2395DW','MS521dn','Color LaserJet Pro M255dw'];
  v_phn_m  TEXT[] := ARRAY['Cisco','Polycom','Cisco'];
  v_phn_d  TEXT[] := ARRAY['IP Phone 8845','VVX 450','IP Phone 7841'];
  v_net_m  TEXT[] := ARRAY['Cisco','Juniper','Cisco','Aruba'];
  v_net_d  TEXT[] := ARRAY['Catalyst 9300-48P','EX3400-48P','ISR 4331','CX 6200'];
  v_tv_m   TEXT[] := ARRAY['Samsung','LG','Sony'];
  v_tv_d   TEXT[] := ARRAY['QN55Q60B','55UP7000PUA','KD-55X80K'];

  v_hd_mfg   TEXT[] := ARRAY['Western Digital','Seagate','Samsung','Crucial','Toshiba','Intel'];
  v_hd_sizes TEXT[] := ARRAY['256GB SSD','512GB SSD','1TB HDD','500GB HDD','1.2TB SAS','2TB SATA'];
  v_cosm     TEXT[] := ARRAY['C1','C2','C2','C3','C3','C4','C5'];
  v_func     TEXT[] := ARRAY['F1','F1','F2','F2','F3','F4','F5'];

BEGIN
  FOR t IN 1..25 LOOP
    -- Build transaction UUID and number
    v_txn_id := ('c0000001-0001-4000-8000-0000000000' || LPAD(t::TEXT, 2, '0'))::UUID;
    v_txn_date := '2025-11-01'::DATE + ((t - 1) * 5);
    v_txn_number := 'T' || TO_CHAR(v_txn_date, 'YYYYMMDD') || '.98' || LPAD(t::TEXT, 3, '0');

    SELECT id INTO v_client_id
    FROM clients WHERE account_number = v_accounts[((t - 1) % 10) + 1];

    INSERT INTO transactions (id, transaction_number, transaction_date, client_id, special_instructions)
    VALUES (v_txn_id, v_txn_number, v_txn_date, v_client_id,
      v_instructions[((t - 1) % array_length(v_instructions, 1)) + 1]);

    -- 21 assets per transaction = 525 total
    FOR a IN 1..21 LOOP
      v_asset_counter := v_asset_counter + 1;
      v_asset_id := gen_random_uuid();

      -- Pick type
      v_type_idx := ((v_asset_counter - 1) % array_length(v_types, 1)) + 1;
      v_asset_type := v_types[v_type_idx];

      -- Pick status (offset by transaction for variety)
      v_status_idx := ((v_asset_counter + t * 3 - 1) % array_length(v_statuses, 1)) + 1;
      v_status := v_statuses[v_status_idx];

      -- Pick manufacturer/model
      CASE v_asset_type
        WHEN 'desktop' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_desk_m, 1)) + 1;
          v_manufacturer := v_desk_m[v_mfg_idx]; v_model := v_desk_d[v_mfg_idx];
        WHEN 'laptop' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_lap_m, 1)) + 1;
          v_manufacturer := v_lap_m[v_mfg_idx]; v_model := v_lap_d[v_mfg_idx];
        WHEN 'server' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_srv_m, 1)) + 1;
          v_manufacturer := v_srv_m[v_mfg_idx]; v_model := v_srv_d[v_mfg_idx];
        WHEN 'monitor' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_mon_m, 1)) + 1;
          v_manufacturer := v_mon_m[v_mfg_idx]; v_model := v_mon_d[v_mfg_idx];
        WHEN 'printer' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_prt_m, 1)) + 1;
          v_manufacturer := v_prt_m[v_mfg_idx]; v_model := v_prt_d[v_mfg_idx];
        WHEN 'phone' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_phn_m, 1)) + 1;
          v_manufacturer := v_phn_m[v_mfg_idx]; v_model := v_phn_d[v_mfg_idx];
        WHEN 'network' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_net_m, 1)) + 1;
          v_manufacturer := v_net_m[v_mfg_idx]; v_model := v_net_d[v_mfg_idx];
        WHEN 'tv' THEN
          v_mfg_idx := ((v_asset_counter - 1) % array_length(v_tv_m, 1)) + 1;
          v_manufacturer := v_tv_m[v_mfg_idx]; v_model := v_tv_d[v_mfg_idx];
        ELSE
          v_manufacturer := NULL; v_model := NULL;
      END CASE;

      -- Tracking mode: every 20th asset is bulk
      IF v_asset_counter % 20 = 0 THEN
        v_tracking_mode := 'bulk';
        v_quantity := 5 + (v_asset_counter % 21);
        v_serial := NULL;
        v_asset_tag := NULL;
      ELSE
        v_tracking_mode := 'serialized';
        v_quantity := 1;
        v_serial := UPPER(LEFT(v_asset_type, 3)) || '-VT-' || LPAD(v_asset_counter::TEXT, 5, '0');
        IF v_asset_counter % 5 != 0 THEN
          v_asset_tag := 'VT-' || LPAD(v_asset_counter::TEXT, 5, '0');
        ELSE
          v_asset_tag := NULL;
        END IF;
      END IF;

      -- Weight: ~33% of assets + all recycled
      IF v_asset_counter % 3 = 0 OR v_status = 'recycled' THEN
        v_weight := CASE v_asset_type
          WHEN 'server'  THEN (25.0 + (v_asset_counter % 30))::NUMERIC(10,2)
          WHEN 'desktop'  THEN (8.0 + (v_asset_counter % 12))::NUMERIC(10,2)
          WHEN 'laptop'  THEN (3.0 + (v_asset_counter % 5))::NUMERIC(10,2)
          WHEN 'monitor'  THEN (6.0 + (v_asset_counter % 10))::NUMERIC(10,2)
          WHEN 'printer'  THEN (10.0 + (v_asset_counter % 20))::NUMERIC(10,2)
          WHEN 'tv'      THEN (15.0 + (v_asset_counter % 25))::NUMERIC(10,2)
          ELSE (2.0 + (v_asset_counter % 8))::NUMERIC(10,2)
        END;
      ELSE
        v_weight := NULL;
      END IF;

      -- Destination and available_for_sale
      v_destination := 'pending';
      v_available := false;
      IF v_status IN ('available', 'sold') THEN
        v_destination := 'external_reuse';
        v_available := true;
        -- Some internal_reuse
        IF v_asset_counter % 7 = 0 THEN
          v_destination := 'internal_reuse';
          v_available := false;
        END IF;
      ELSIF v_status = 'recycled' THEN
        v_destination := 'recycle';
      END IF;

      -- Notes (occasional)
      IF v_asset_counter % 7 = 0 THEN
        v_notes := 'Volume test asset #' || v_asset_counter;
      ELSIF v_asset_counter % 11 = 0 THEN
        v_notes := 'Priority item — expedite processing';
      ELSIF v_asset_counter % 13 = 0 THEN
        v_notes := 'Customer requested photo documentation';
      ELSE
        v_notes := NULL;
      END IF;

      -- ==== INSERT ASSET ====
      INSERT INTO assets (
        id, transaction_id, serial_number, asset_type, tracking_mode,
        manufacturer, model, model_name, asset_tag, quantity,
        weight, status, asset_destination, available_for_sale, notes
      ) VALUES (
        v_asset_id, v_txn_id, v_serial, v_asset_type, v_tracking_mode,
        v_manufacturer, v_model, v_model, v_asset_tag, v_quantity,
        v_weight, v_status, v_destination, v_available, v_notes
      );

      -- ==== INSERT INVENTORY ====
      v_location := CASE
        WHEN v_status = 'received'   THEN 'RECEIVING'
        WHEN v_status = 'in_process' THEN 'TESTING'
        WHEN v_status = 'tested'     THEN 'TESTING'
        WHEN v_status = 'graded'     THEN 'STAGING'
        WHEN v_status = 'sanitized'  THEN 'SANITIZATION'
        WHEN v_status = 'available'  THEN 'WAREHOUSE'
        WHEN v_status = 'sold'       THEN 'SHIPPING'
        WHEN v_status = 'recycled'   THEN 'RECYCLING'
        WHEN v_status = 'on_hold'    THEN 'QUARANTINE'
        ELSE 'RECEIVING'
      END;

      v_inv_status := CASE
        WHEN v_status IN ('available', 'sold', 'recycled') THEN 'available'
        WHEN v_status = 'on_hold' THEN 'quarantine'
        ELSE 'in_process'
      END;

      v_inv_desc := COALESCE(v_manufacturer || ' ' || v_model, v_asset_type);

      INSERT INTO inventory (asset_id, location, quantity_on_hand, unit_of_measure, status, description)
      VALUES (v_asset_id, v_location, v_quantity, 'EA', v_inv_status, v_inv_desc)
      RETURNING id INTO v_inv_id;

      -- ==== INSERT JOURNAL (receipt) ====
      INSERT INTO inventory_journal (
        inventory_id, asset_id, transaction_id, movement_type,
        quantity, to_location, reference_number, reason
      ) VALUES (
        v_inv_id, v_asset_id, v_txn_id, 'receipt',
        v_quantity, v_location, v_txn_number, 'Initial receipt at intake'
      );

      -- ==== INSERT STATUS HISTORY ====
      INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
      VALUES (v_asset_id, NULL, 'received', 'Initial intake');

      IF v_status IN ('in_process','tested','graded','sanitized','available','sold','recycled') THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'received', 'in_process', 'Moved to processing');
      END IF;

      IF v_status IN ('tested','graded','sanitized','available','sold','recycled') THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'in_process', 'tested', 'Testing complete');
      END IF;

      IF v_status IN ('graded','sanitized','available','sold','recycled') THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'tested', 'graded', 'Grading complete');
      END IF;

      IF v_status IN ('sanitized','available','sold') THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'graded', 'sanitized', 'Sanitization complete');
      END IF;

      IF v_status IN ('available','sold') THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'sanitized', 'available', 'Available for disposition');
      END IF;

      IF v_status = 'sold' THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'available', 'sold', 'Sold to buyer');
      END IF;

      IF v_status = 'recycled' THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'graded', 'recycled', 'Marked for recycling — not economically repairable');
      END IF;

      IF v_status = 'on_hold' THEN
        INSERT INTO asset_status_history (asset_id, previous_status, new_status, reason_for_change)
        VALUES (v_asset_id, 'received', 'on_hold', 'On hold — pending customer instructions');
      END IF;

      -- ==== INSERT HARD DRIVES (storage-bearing types, every 3rd) ====
      IF v_asset_type IN ('desktop','laptop','server') AND v_asset_counter % 3 = 0 THEN
        v_num_drives := CASE
          WHEN v_asset_type = 'server' THEN 2 + ((v_asset_counter / 3) % 4)
          ELSE 1
        END;

        FOR d IN 1..v_num_drives LOOP
          INSERT INTO asset_hard_drives (
            asset_id, drive_number, serial_number, manufacturer, size,
            sanitization_method, sanitization_details, sanitization_tech,
            sanitization_date, date_crushed
          ) VALUES (
            v_asset_id, d,
            'HD-VT-' || LPAD(v_asset_counter::TEXT, 5, '0') || '-D' || d,
            v_hd_mfg[((v_asset_counter + d - 1) % array_length(v_hd_mfg, 1)) + 1],
            v_hd_sizes[((v_asset_counter + d - 1) % array_length(v_hd_sizes, 1)) + 1],
            CASE
              WHEN v_status IN ('sanitized','available','sold') THEN 'wipe'
              WHEN v_status = 'recycled' THEN 'destruct_shred'
              ELSE NULL
            END,
            CASE
              WHEN v_status IN ('sanitized','available','sold') THEN 'NIST 800-88 Clear — 3-pass overwrite'
              WHEN v_status = 'recycled' THEN 'Physical destruction — industrial shredder'
              ELSE NULL
            END,
            CASE
              WHEN v_status IN ('sanitized','available','sold','recycled') THEN 'Amber Holliday'
              ELSE NULL
            END,
            CASE
              WHEN v_status IN ('sanitized','available','sold','recycled') THEN v_txn_date + 3
              ELSE NULL
            END,
            CASE
              WHEN v_status = 'recycled' THEN v_txn_date + 5
              ELSE NULL
            END
          );
        END LOOP;
      END IF;

      -- ==== INSERT GRADING (status >= graded) ====
      IF v_status IN ('graded','sanitized','available','sold','recycled') THEN
        INSERT INTO asset_grading (
          asset_id, cosmetic_category, functioning_category,
          does_unit_power_up, does_unit_function_properly
        ) VALUES (
          v_asset_id,
          v_cosm[((v_asset_counter - 1) % array_length(v_cosm, 1)) + 1],
          v_func[((v_asset_counter - 1) % array_length(v_func, 1)) + 1],
          v_status != 'recycled',
          v_status != 'recycled'
        );
      END IF;

      -- ==== INSERT DEVICE-LEVEL SANITIZATION ====
      IF v_status IN ('sanitized','available','sold') AND v_asset_type IN ('desktop','laptop','server') THEN
        INSERT INTO asset_sanitization (asset_id, sanitization_method, sanitization_details, inspection_tech)
        VALUES (v_asset_id, 'wipe', 'NIST 800-88 Clear verified at device level', 'Amber Holliday');
      END IF;

      IF v_status = 'recycled' AND v_asset_type IN ('desktop','laptop','server') THEN
        INSERT INTO asset_sanitization (asset_id, sanitization_method, sanitization_details, inspection_tech)
        VALUES (v_asset_id, 'destruct_shred', 'All drives physically destroyed', 'Amber Holliday');
      END IF;

    END LOOP; -- assets
  END LOOP; -- transactions

  RAISE NOTICE 'Volume test complete: 25 transactions, % assets created', v_asset_counter;
END $generate$;

-- ============================================================================
-- VERIFICATION — Run these queries to confirm the seed worked
-- ============================================================================

SELECT 'Volume test transactions' AS label, COUNT(*) AS count
FROM transactions WHERE id::text LIKE 'c0000001-0001-4000-8000-0000000000%';

SELECT 'Volume test assets' AS label, COUNT(*) AS count
FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%';

SELECT asset_type, COUNT(*) AS count
FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
GROUP BY asset_type ORDER BY count DESC;

SELECT status, COUNT(*) AS count
FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
GROUP BY status ORDER BY count DESC;

SELECT 'Inventory records' AS label, COUNT(*) AS count
FROM inventory WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
)
UNION ALL
SELECT 'Journal entries', COUNT(*)
FROM inventory_journal WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
)
UNION ALL
SELECT 'Status history', COUNT(*)
FROM asset_status_history WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
)
UNION ALL
SELECT 'Hard drives', COUNT(*)
FROM asset_hard_drives WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
)
UNION ALL
SELECT 'Grading records', COUNT(*)
FROM asset_grading WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
)
UNION ALL
SELECT 'Sanitization records', COUNT(*)
FROM asset_sanitization WHERE asset_id IN (
  SELECT id FROM assets WHERE transaction_id::text LIKE 'c0000001-0001-4000-8000-0000000000%'
);

-- Total assets across all seeds (should be 72 + 525 = 597)
SELECT 'Total assets in database' AS label, COUNT(*) AS count FROM assets;
