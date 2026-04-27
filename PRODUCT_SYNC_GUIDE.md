# Product Sync Implementation Guide

This guide explains how to deploy and test the product sync Edge function for M1.2 milestone.

## What Was Built

### 1. Database Schema ✅
- **`products` table** - Stores all products from multiple POS systems
- **`product_categories` table** - Pre-populated with 15 categories (6 restricted)
- **Helper functions** - `is_product_restricted()`, `get_product_barter_eligibility()`
- **View** - `products_with_eligibility` for easy querying

### 2. Product Sync Edge Function ✅
- **Location**: `supabase/functions/pos-product-sync/`
- **Providers Implemented**:
  - ✅ **Square** - Full implementation with category mapping
  - ⏳ Shopify - Placeholder (TODO)
  - ⏳ Clover - Placeholder (TODO)
  - ⏳ Toast - Placeholder (TODO)

### 3. Key Features
- **Multi-POS Support** - Each product linked to specific POS integration
- **Automatic Category Mapping** - Detects restricted products (alcohol, tobacco, etc.)
- **Barter Eligibility** - Auto-disables barter for restricted items
- **Upsert Logic** - Updates existing products, inserts new ones
- **Error Handling** - Comprehensive logging and error reporting

---

## Deployment Instructions

### Step 1: Deploy the Edge Function

```bash
# Deploy the product sync function
npx supabase functions deploy pos-product-sync

# Verify deployment
npx supabase functions list
```

### Step 2: Set Environment Variables (if needed)

The function uses these env vars (already set in Supabase):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

No additional configuration needed for Square (uses access tokens from `pos_integrations` table).

### Step 3: Verify Database Migration

Go to Supabase Dashboard → Database → Tables and confirm:
- ✅ `products` table exists
- ✅ `product_categories` table exists (with 15 categories)

Or run the test SQL:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('products', 'product_categories');
```

---

## Testing Instructions

### Method 1: Using the Test Script (Recommended)

1. **Update test credentials** in `test-product-sync.ts`:
   ```typescript
   email: 'YOUR_EMAIL@example.com',
   password: 'YOUR_PASSWORD'
   ```

2. **Run the test**:
   ```bash
   npx tsx test-product-sync.ts
   ```

3. **Expected output**:
   ```
   🧪 Starting Product Sync Test

   1️⃣ Authenticating user...
   ✅ Authenticated as: merchant@example.com
      User ID: abc123...

   2️⃣ Fetching POS integrations...
   ✅ Found 1 active integration(s):
      1. square (ID: xyz789...)

   3️⃣ Testing product sync for: square
      Products before sync: 0
      📡 Calling product sync Edge function...

   ✅ Sync completed!
      Result: {
        "success": true,
        "message": "Products synced successfully",
        "synced": 25,
        "skipped": 0
      }

   4️⃣ Verifying products in database...
   ✅ Products after sync: 25
      New products added: 25

      📦 Sample products:
      1. Coffee - Large
         Price: $4.50
         SKU: COFFEE-L
         Barter Enabled: ✅
         Synced: 2025-12-18T12:00:00Z

   5️⃣ Checking for restricted products...
   ✅ No restricted products found

   🎉 Product sync test completed successfully!
   ```

### Method 2: Manual API Call

Using curl or Postman:

```bash
# Get your user token first (login via Supabase Auth)
TOKEN="your-user-token-here"

# Get your POS integration ID
POS_INTEGRATION_ID="your-pos-integration-id"

# Call the Edge function
curl -X POST \
  "https://YOUR_PROJECT_REF.supabase.co/functions/v1/pos-product-sync" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"pos_integration_id\": \"$POS_INTEGRATION_ID\"}"
```

### Method 3: Supabase Dashboard SQL Editor

```sql
-- 1. Check if products were synced
SELECT
  COUNT(*) as total_products,
  COUNT(CASE WHEN barter_enabled = false THEN 1 END) as restricted_products
FROM products;

-- 2. View sample products with barter eligibility
SELECT
  name,
  price,
  category_name,
  is_barter_eligible,
  effective_barter_percentage
FROM products_with_eligibility
LIMIT 10;

-- 3. Check restricted categories
SELECT
  pc.name as category,
  COUNT(p.id) as product_count
FROM product_categories pc
LEFT JOIN products p ON p.category_id = pc.id
WHERE pc.is_restricted = true
GROUP BY pc.name;

-- 4. View sync status
SELECT
  pi.provider,
  COUNT(p.id) as products_synced,
  MAX(p.last_synced_at) as last_sync
FROM pos_integrations pi
LEFT JOIN products p ON p.pos_integration_id = pi.id
GROUP BY pi.provider;
```

---

## How Product Sync Works

### Flow Diagram:
```
1. User calls Edge function → /pos-product-sync
   Body: { pos_integration_id: "abc123" }

2. Function authenticates user
   - Verifies JWT token
   - Checks user owns the integration

3. Fetch POS integration details
   - Get access_token
   - Get provider (square, shopify, etc.)

4. Call POS API to get products
   - Square: /v2/catalog/list?types=ITEM
   - Shopify: /admin/api/2024-01/products.json
   - etc.

5. For each product:
   a. Map category → detect restricted items
   b. Check if product exists (upsert logic)
   c. Save to products table

6. Return result:
   {
     "success": true,
     "synced": 25,
     "skipped": 2,
     "errors": []
   }
```

### Category Mapping Logic:

The `category-mapper.ts` utility:

1. **Detects restricted keywords** in product name/description:
   - Alcohol: beer, wine, liquor, vodka, etc.
   - Tobacco: cigarette, cigar, vape, etc.
   - Lottery: scratch, powerball, lotto, etc.
   - Gift Cards: gift card, prepaid, etc.
   - Pharmacy: prescription, medication, etc.
   - Firearms: gun, ammunition, weapon, etc.

2. **Maps to database categories**:
   - If restricted → auto-disable barter
   - Otherwise → match POS category or default to "other"

3. **Sets metadata**:
   ```json
   {
     "is_restricted": true,
     "restriction_reason": "Restricted category: alcohol",
     "square_category_id": "xyz"
   }
   ```

---

## Expected Results

After successful sync:

✅ **Products Table Populated**
- Products from Square catalog saved
- Each product linked to `pos_integration_id`
- Category mapped correctly
- Restricted items have `barter_enabled = false`

✅ **Barter Eligibility Enforced**
- Alcohol, tobacco, etc. automatically flagged
- `products_with_eligibility` view shows status
- Ready for checkout validation

✅ **Multi-POS Support**
- Merchant with Square + Shopify → separate product entries per POS
- Unique constraint: `(pos_integration_id, external_product_id, external_variant_id)`

---

## Troubleshooting

### Issue: "No products found in Square catalog"
**Solution**:
- Check if your Square account has items in the catalog
- Verify access token has `ITEMS_READ` scope
- Check if using sandbox vs production environment

### Issue: "Authentication failed"
**Solution**:
- Verify user token is valid
- Check `pos_integrations.user_id` matches authenticated user
- Ensure integration status is 'active'

### Issue: "Duplicate key violation"
**Solution**:
- Product already exists, this is expected
- The upsert logic should handle this - check logs

### Issue: "Category not found"
**Solution**:
- Ensure product_categories migration was applied
- Run: `SELECT * FROM product_categories;` to verify data

### Issue: "Square API rate limit"
**Solution**:
- Square limits: 10 requests/second
- Add delay between requests if syncing many products
- Consider batch processing

---

## Next Steps

Once product sync is working:

1. ✅ **Test with real Square data**
2. ⏳ **Implement webhook auto-sync** - Sync products when transactions occur
3. ⏳ **Build Product Dashboard** - UI for merchants to view/manage products
4. ⏳ **Implement Shopify/Clover/Toast** - Complete other providers
5. ⏳ **Add inventory tracking** - Sync stock levels from POS

---

## Files Created

```
supabase/
├── migrations/
│   └── 20251218120000_create_products_and_categories.sql
└── functions/
    └── pos-product-sync/
        ├── index.ts                    # Main Edge function
        ├── utils/
        │   └── category-mapper.ts      # Category detection logic
        └── providers/
            ├── square.ts               # Square product sync ✅
            ├── shopify.ts              # Shopify (placeholder)
            ├── clover.ts               # Clover (placeholder)
            └── toast.ts                # Toast (placeholder)

src/integrations/supabase/
└── types.ts                            # Updated with products types

test-product-sync.ts                    # Test script
PRODUCT_SYNC_GUIDE.md                   # This file
```

---

## API Reference

### Endpoint
```
POST https://YOUR_PROJECT.supabase.co/functions/v1/pos-product-sync
```

### Headers
```
Authorization: Bearer <user-jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "pos_integration_id": "uuid-here"
}
```

### Response (Success)
```json
{
  "success": true,
  "message": "Products synced successfully",
  "synced": 25,
  "skipped": 2,
  "errors": ["item123: Missing price"]
}
```

### Response (Error)
```json
{
  "success": false,
  "error": "POS integration not found or inactive"
}
```

---

## Support

For issues or questions:
1. Check the logs in Supabase Dashboard → Edge Functions → Logs
2. Review the function code in `supabase/functions/pos-product-sync/`
3. Test the database schema with `test-products-table.sql`

Happy syncing! 🚀
