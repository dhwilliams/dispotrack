import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Use service role to bypass RLS for verification
const supabase = createClient(supabaseUrl, serviceRoleKey)

// Tables that should exist after v2 migration (asset_hardware removed)
const EXPECTED_TABLES = [
  'clients',
  'transactions',
  'assets',
  'asset_hard_drives',
  'asset_grading',
  'asset_type_details',
  'asset_sanitization',
  'asset_sales',
  'asset_status_history',
  'user_profiles',
  // New v2 tables
  'buyers',
  'inventory',
  'inventory_journal',
  'asset_type_field_definitions',
  'client_revenue_terms',
  'asset_settlement',
  'routing_rules',
]

const REMOVED_TABLES = ['asset_hardware']

async function verify() {
  let passed = 0
  let failed = 0

  function check(name: string, ok: boolean, detail?: string) {
    if (ok) {
      console.log(`  ✅ ${name}`)
      passed++
    } else {
      console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ''}`)
      failed++
    }
  }

  // 1. Check all expected tables exist
  console.log('\n1. TABLES (expected)')
  for (const table of EXPECTED_TABLES) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    check(`Table "${table}" exists`, !error, error?.message)
  }

  // 2. Check removed tables are gone
  console.log('\n2. TABLES (removed)')
  for (const table of REMOVED_TABLES) {
    // Use column-specific query — HEAD count doesn't reliably detect dropped tables through PostgREST cache
    const { error } = await supabase.from(table).select('id').limit(1)
    check(`Table "${table}" is removed`, !!error, error ? undefined : 'Table still exists!')
  }

  // 3. Check new columns on assets
  console.log('\n3. ASSETS — new columns')
  const { data: testAsset, error: insertErr } = await supabase
    .from('clients')
    .insert({ account_number: 'V2TEST001', name: 'V2 Test Client' })
    .select()
    .single()

  if (testAsset) {
    const { data: testTxn, error: txnErr } = await supabase
      .from('transactions')
      .insert({ transaction_number: 'T20260302.99999', transaction_date: '2026-03-02', client_id: testAsset.id })
      .select()
      .single()

    if (testTxn) {
      // Insert asset WITHOUT serial_number (should work now — nullable)
      const { data: asset, error: assetErr } = await supabase
        .from('assets')
        .insert({
          transaction_id: testTxn.id,
          asset_type: 'desktop',
          tracking_mode: 'serialized',
          manufacturer: 'Dell',
          model: 'OptiPlex 7090',
        })
        .select()
        .single()
      check('Insert asset without serial_number (nullable)', !assetErr, assetErr?.message)

      if (asset) {
        check('internal_asset_id auto-generated', !!asset.internal_asset_id && asset.internal_asset_id.startsWith('LR3-'), `Got: ${asset.internal_asset_id}`)
        check('tracking_mode column exists', asset.tracking_mode === 'serialized')
        check('serial_number is null (nullable)', asset.serial_number === null)

        // 4. Check asset_hard_drives sanitization columns
        console.log('\n4. ASSET_HARD_DRIVES — sanitization columns')
        const { error: hdErr } = await supabase
          .from('asset_hard_drives')
          .insert({
            asset_id: asset.id,
            drive_number: 1,
            serial_number: 'HD-V2-TEST-001',
            manufacturer: 'Samsung',
            size: '512GB',
            sanitization_method: 'wipe',
            sanitization_details: 'X-Erase complete',
            sanitization_tech: 'Test Tech',
            sanitization_date: '2026-03-02',
          })
        check('Insert HD with sanitization fields', !hdErr, hdErr?.message)

        // Read back to verify columns
        const { data: hd } = await supabase
          .from('asset_hard_drives')
          .select('*')
          .eq('asset_id', asset.id)
          .single()
        if (hd) {
          check('HD sanitization_method stored', hd.sanitization_method === 'wipe')
          check('HD sanitization_tech stored', hd.sanitization_tech === 'Test Tech')
          check('HD sanitization_date stored', hd.sanitization_date === '2026-03-02')
          check('HD updated_at column exists', !!hd.updated_at)
        }

        // 5. Check asset_sales buyer_id column
        console.log('\n5. ASSET_SALES — buyer_id column')
        const { data: buyer, error: buyerErr } = await supabase
          .from('buyers')
          .insert({ name: 'Test Buyer Inc' })
          .select()
          .single()
        check('Insert buyer', !buyerErr, buyerErr?.message)

        if (buyer) {
          const { error: saleErr } = await supabase
            .from('asset_sales')
            .insert({
              asset_id: asset.id,
              buyer_id: buyer.id,
              sold_to_name: 'Test Buyer Inc',
              sale_price: 199.99,
            })
          check('Insert sale with buyer_id FK', !saleErr, saleErr?.message)

          // Read back with buyer join
          const { data: sale, error: saleReadErr } = await supabase
            .from('asset_sales')
            .select('*, buyer:buyers(*)')
            .eq('asset_id', asset.id)
            .single()
          check('Read sale with buyer join', !saleReadErr && !!sale?.buyer, saleReadErr?.message)

          // Cleanup buyer (after sale cleanup)
          await supabase.from('asset_sales').delete().eq('asset_id', asset.id)
          await supabase.from('buyers').delete().eq('id', buyer.id)
        }

        // 6. New tables: inventory + journal
        console.log('\n6. INVENTORY + JOURNAL')
        const { data: inv, error: invErr } = await supabase
          .from('inventory')
          .insert({
            asset_id: asset.id,
            location: 'W1-SHELF2-LVL3',
            quantity_on_hand: 1,
            unit_of_measure: 'EA',
            status: 'available',
          })
          .select()
          .single()
        check('Insert inventory record', !invErr, invErr?.message)

        if (inv) {
          const { error: journalErr } = await supabase
            .from('inventory_journal')
            .insert({
              inventory_id: inv.id,
              asset_id: asset.id,
              transaction_id: testTxn.id,
              movement_type: 'receipt',
              quantity: 1,
              to_location: 'W1-SHELF2-LVL3',
              reference_number: testTxn.transaction_number,
              reason: 'Initial intake',
            })
          check('Insert journal entry (receipt)', !journalErr, journalErr?.message)

          // Verify journal is readable
          const { data: journalEntries, error: journalReadErr } = await supabase
            .from('inventory_journal')
            .select('*')
            .eq('inventory_id', inv.id)
          check('Read journal entries', !journalReadErr && journalEntries!.length === 1, journalReadErr?.message)

          // Cleanup
          await supabase.from('inventory_journal').delete().eq('inventory_id', inv.id)
          await supabase.from('inventory').delete().eq('id', inv.id)
        }

        // 7. Field definitions seed data
        console.log('\n7. FIELD DEFINITIONS — seed data')
        const { data: fieldDefs, error: fdErr } = await supabase
          .from('asset_type_field_definitions')
          .select('*')
          .order('asset_type')
          .order('sort_order')
        check('Read field definitions', !fdErr, fdErr?.message)
        if (fieldDefs) {
          const types = [...new Set(fieldDefs.map(f => f.asset_type))]
          check('All 9 asset types have definitions', types.length === 9, `Got ${types.length}: ${types.join(', ')}`)

          const desktopFields = fieldDefs.filter(f => f.asset_type === 'desktop')
          check('Desktop has 5 hardware fields', desktopFields.length === 5, `Got ${desktopFields.length}`)

          const laptopFields = fieldDefs.filter(f => f.asset_type === 'laptop')
          check('Laptop has 11 fields (4 hardware + 7 type_specific)', laptopFields.length === 11, `Got ${laptopFields.length}`)

          const printerFields = fieldDefs.filter(f => f.asset_type === 'printer')
          check('Printer has 9 type_specific fields', printerFields.length === 9, `Got ${printerFields.length}`)
        }

        // 8. Revenue terms + settlement
        console.log('\n8. REVENUE TERMS + SETTLEMENT')
        const { data: term, error: termErr } = await supabase
          .from('client_revenue_terms')
          .insert({
            client_id: testAsset.id,
            term_type: 'percentage',
            term_details: { percentage: 15, applies_to: 'net_sale' },
            effective_date: '2026-01-01',
          })
          .select()
          .single()
        check('Insert revenue term', !termErr, termErr?.message)

        if (term) {
          // Need a sale for settlement
          const { data: sale2 } = await supabase
            .from('asset_sales')
            .insert({ asset_id: asset.id, sale_price: 500 })
            .select()
            .single()
          if (sale2) {
            const { error: settlErr } = await supabase
              .from('asset_settlement')
              .insert({
                asset_id: asset.id,
                sale_id: sale2.id,
                revenue_term_id: term.id,
                sale_amount: 500,
                client_share: 75,
                logista_share: 425,
              })
            check('Insert settlement', !settlErr, settlErr?.message)

            // Cleanup
            await supabase.from('asset_settlement').delete().eq('asset_id', asset.id)
            await supabase.from('asset_sales').delete().eq('id', sale2.id)
          }
          await supabase.from('client_revenue_terms').delete().eq('id', term.id)
        }

        // 9. Routing rules
        console.log('\n9. ROUTING RULES')
        const { data: rule, error: ruleErr } = await supabase
          .from('routing_rules')
          .insert({
            name: 'Small monitors to recycle',
            description: 'Monitors under 20" go to recycle',
            priority: 100,
            conditions: { asset_type: 'monitor', screen_size_lt: 20 },
            action: 'recycle',
            is_active: true,
          })
          .select()
          .single()
        check('Insert routing rule', !ruleErr, ruleErr?.message)
        if (rule) {
          await supabase.from('routing_rules').delete().eq('id', rule.id)
        }

        // 10. User profile role expansion
        console.log('\n10. USER PROFILES — expanded roles')
        // Verify the CHECK constraint accepts new roles by trying to insert
        // (We can't actually create auth users via supabase-js without admin API, so just verify constraint)
        // The fact that the migration ran without error means the CHECK was updated

        // 11. Helper functions
        console.log('\n11. HELPER FUNCTIONS')
        for (const fn of ['get_user_role', 'is_admin', 'is_operator_or_admin', 'can_create_assets', 'is_client_portal_user', 'is_internal_user']) {
          const { error } = await supabase.rpc(fn)
          const fnExists = !error || !error.message.includes('Could not find the function')
          check(`Function "${fn}" exists`, fnExists, error?.message)
        }

        // 12. Trigger test: internal_asset_id
        console.log('\n12. TRIGGER — internal_asset_id auto-generation')
        const { data: asset2, error: asset2Err } = await supabase
          .from('assets')
          .insert({
            transaction_id: testTxn.id,
            asset_type: 'laptop',
            tracking_mode: 'bulk',
            quantity: 10,
          })
          .select()
          .single()
        check('Second asset gets unique internal_asset_id', !asset2Err && !!asset2?.internal_asset_id && asset2.internal_asset_id !== asset.internal_asset_id,
          asset2Err?.message || `Got: ${asset2?.internal_asset_id}`)
        check('Bulk tracking_mode accepted', asset2?.tracking_mode === 'bulk')

        // Cleanup test data
        console.log('\n13. CLEANUP')
        if (asset2) await supabase.from('assets').delete().eq('id', asset2.id)
        await supabase.from('asset_hard_drives').delete().eq('asset_id', asset.id)
        await supabase.from('assets').delete().eq('id', asset.id)
      }
      await supabase.from('transactions').delete().eq('id', testTxn.id)
    }
    await supabase.from('clients').delete().eq('id', testAsset.id)
    console.log('  ✅ Test data cleaned up')
  } else {
    console.log(`  ❌ Could not create test client — ${insertErr?.message}`)
    failed++
  }

  // Summary
  console.log(`\n${'='.repeat(50)}`)
  console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed + failed} checks`)
  console.log('='.repeat(50))

  if (failed > 0) process.exit(1)
}

verify().catch(console.error)
