/**
 * Test Product Sync Edge Function
 *
 * This script tests the product sync functionality by calling the Edge function
 * and verifying products are saved to the database.
 *
 * Prerequisites:
 * 1. Deploy the pos-product-sync Edge function: npx supabase functions deploy pos-product-sync
 * 2. Have an active POS integration (Square, Shopify, etc.)
 * 3. Set up environment variables in .env.local
 */

import { createClient } from '@supabase/supabase-js';

// Load environment variables
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testProductSync() {
  console.log('🧪 Starting Product Sync Test\n');

  try {
    // Step 1: Authenticate (replace with actual user credentials)
    console.log('1️⃣ Authenticating user...');
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: 'YOUR_EMAIL@example.com', // Replace with your test user email
      password: 'YOUR_PASSWORD' // Replace with your test user password
    });

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    console.log('✅ Authenticated as:', authData.user.email);
    console.log('   User ID:', authData.user.id);

    // Step 2: Get active POS integrations
    console.log('\n2️⃣ Fetching POS integrations...');
    const { data: integrations, error: integrationsError } = await supabase
      .from('pos_integrations')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('status', 'active');

    if (integrationsError) {
      throw new Error(`Failed to fetch integrations: ${integrationsError.message}`);
    }

    if (!integrations || integrations.length === 0) {
      throw new Error('No active POS integrations found. Please connect a POS system first.');
    }

    console.log(`✅ Found ${integrations.length} active integration(s):`);
    integrations.forEach((int, idx) => {
      console.log(`   ${idx + 1}. ${int.provider} (ID: ${int.id})`);
    });

    // Step 3: Test product sync for first integration
    const testIntegration = integrations[0];
    console.log(`\n3️⃣ Testing product sync for: ${testIntegration.provider}`);
    console.log(`   Integration ID: ${testIntegration.id}`);

    // Get count of existing products before sync
    const { count: beforeCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true })
      .eq('pos_integration_id', testIntegration.id);

    console.log(`   Products before sync: ${beforeCount || 0}`);

    // Call the Edge function
    console.log('\n   📡 Calling product sync Edge function...');
    const { data: syncResult, error: syncError } = await supabase.functions.invoke(
      'pos-product-sync',
      {
        body: { pos_integration_id: testIntegration.id }
      }
    );

    if (syncError) {
      throw new Error(`Sync failed: ${syncError.message}`);
    }

    console.log('\n✅ Sync completed!');
    console.log('   Result:', JSON.stringify(syncResult, null, 2));

    // Step 4: Verify products were saved
    console.log('\n4️⃣ Verifying products in database...');
    const { data: products, count: afterCount, error: productsError } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('pos_integration_id', testIntegration.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    console.log(`✅ Products after sync: ${afterCount || 0}`);
    console.log(`   New products added: ${(afterCount || 0) - (beforeCount || 0)}`);

    if (products && products.length > 0) {
      console.log('\n   📦 Sample products:');
      products.slice(0, 5).forEach((product, idx) => {
        console.log(`\n   ${idx + 1}. ${product.name}`);
        console.log(`      Price: $${product.price}`);
        console.log(`      SKU: ${product.sku || 'N/A'}`);
        console.log(`      Barter Enabled: ${product.barter_enabled ? '✅' : '❌'}`);
        console.log(`      Category ID: ${product.category_id || 'None'}`);
        console.log(`      Synced: ${product.last_synced_at}`);
      });
    }

    // Step 5: Check for restricted products
    console.log('\n5️⃣ Checking for restricted products...');
    const { data: restrictedProducts, count: restrictedCount } = await supabase
      .from('products')
      .select('name, category_id, barter_enabled, metadata', { count: 'exact' })
      .eq('pos_integration_id', testIntegration.id)
      .eq('barter_enabled', false)
      .limit(5);

    if (restrictedCount && restrictedCount > 0) {
      console.log(`⚠️  Found ${restrictedCount} restricted product(s):`);
      restrictedProducts?.forEach((product, idx) => {
        console.log(`   ${idx + 1}. ${product.name}`);
        console.log(`      Reason: ${product.metadata?.restriction_reason || 'Restricted category'}`);
      });
    } else {
      console.log('✅ No restricted products found');
    }

    // Step 6: Check barter eligibility view
    console.log('\n6️⃣ Testing products_with_eligibility view...');
    const { data: eligibilityData, error: viewError } = await supabase
      .from('products_with_eligibility')
      .select('name, is_barter_eligible, category_name, effective_barter_percentage')
      .eq('merchant_id', authData.user.id)
      .limit(5);

    if (viewError) {
      console.error('❌ View query failed:', viewError.message);
    } else if (eligibilityData && eligibilityData.length > 0) {
      console.log('✅ Barter eligibility view working:');
      eligibilityData.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ${item.name}`);
        console.log(`      Category: ${item.category_name || 'None'}`);
        console.log(`      Barter Eligible: ${item.is_barter_eligible ? '✅' : '❌'}`);
        console.log(`      Barter %: ${item.effective_barter_percentage}%`);
      });
    }

    console.log('\n🎉 Product sync test completed successfully!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nStack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testProductSync();
