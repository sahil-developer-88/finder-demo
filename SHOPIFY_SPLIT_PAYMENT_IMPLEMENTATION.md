# Shopify POS Split Payment - Implementation Guide

## ✅ What Has Been Implemented

This document outlines the automated split payment system for Shopify POS that allows customers to pay with barter credits + cash/card in a single transaction.

---

## 📁 Files Created/Modified

### **1. Database Migration**
**File:** `supabase/migrations/20260103000000_pos_split_payment_system.sql`

**New Tables:**
- `pos_barcode_scans` - Tracks one-time use barcodes with expiration
- `pos_payment_sessions` - Manages in-progress POS transactions
- `merchant_pos_settings` - Per-merchant configuration for split payment
- `merchant_daily_barter_limits` - Daily usage limits per customer

**New Functions:**
- `initiate_pos_payment_session()` - Validates barcode, creates session
- `complete_pos_payment_session()` - Finalizes payment, transfers credits
- `rollback_pos_payment_session()` - Reverts session if payment fails
- `expire_old_pos_sessions()` - Auto-expires sessions after 10 minutes

**Security:**
- Row Level Security (RLS) enabled on all tables
- Policies for merchant and customer data access

---

### **2. Shopify OAuth Scopes (Updated)**
**File:** `supabase/functions/pos-oauth-initiate/index.ts`

**Added Scopes:**
```typescript
'write_draft_orders',    // Create/modify draft orders
'read_draft_orders',     // Read draft orders
'write_price_rules',     // Create automatic discounts
'read_price_rules',      // Read discount rules
'write_discounts',       // Apply discount codes
'read_discounts',        // Read discounts
'read_customers'         // Lookup customer by phone/email
```

**Action Required:**
- Merchants must re-authorize their Shopify connection to get new scopes
- OR: Create new OAuth app in Shopify Partner account with these scopes

---

### **3. Shopify Discount Application Edge Function**
**File:** `supabase/functions/shopify-apply-barter/index.ts`

**Functionality:**
1. Receives customer barcode + draft order ID from cashier
2. Validates barcode (not expired, not used)
3. Creates payment session
4. Gets customer credit balance
5. Fetches draft order from Shopify
6. Calculates barter split (total × merchant's barter %)
7. Applies discount to draft order via Shopify API
8. Returns success with payment breakdown

**API Endpoint:**
```
POST /functions/v1/shopify-apply-barter
Authorization: Bearer <user-token>

Body:
{
  "barcode": "user-id-timestamp",
  "draft_order_id": "123456789"
}

Response (Success):
{
  "success": true,
  "session_id": "uuid",
  "draft_order_id": "123456789",
  "customer": {
    "name": "John Doe",
    "credits_before": 100.00,
    "credits_after": 70.00
  },
  "payment": {
    "total": 100.00,
    "barter_amount": 30.00,
    "barter_percentage": 30,
    "cash_amount": 70.00
  },
  "next_steps": [...]
}
```

---

### **4. Shopify Draft Order API Client**
**File:** `supabase/functions/shopify-apply-barter/shopify-draft-order-client.ts`

**Class:** `ShopifyDraftOrderClient`

**Methods:**
- `getDraftOrder(id)` - Fetch draft order details
- `applyDiscountToDraftOrder(id, amount, description)` - Apply fixed dollar discount
- `completeDraftOrder(id)` - Convert draft to order (optional)
- `createDraftOrder(items, customerId)` - Create new draft order
- `searchDraftOrders(status, limit)` - Find open draft orders
- `deleteDraftOrder(id)` - Cancel draft order
- `sendInvoice(id, message)` - Email invoice to customer

**Shopify API Version:** 2024-01

---

### **5. Webhook Handler for Draft Orders**
**File:** `supabase/functions/pos-webhook/providers/shopify.ts`

**New Function:** `handleDraftOrderWebhook()`

**Handles:**
- `draft_orders/create` - Draft order created
- `draft_orders/update` - Draft order updated
  - When `status === 'completed'`: Triggers credit transfer
  - Calls `complete_pos_payment_session()` RPC
  - Debits customer, credits merchant
- `draft_orders/delete` - Draft order cancelled
  - Calls `rollback_pos_payment_session()` RPC
  - Marks barcode as reusable

**Workflow:**
1. Cashier completes payment in Shopify POS
2. Draft order becomes regular order
3. Webhook sent: `draft_orders/update` with `status: 'completed'`
4. Backend finds matching payment session
5. Transfers barter credits
6. Creates transaction record

---

### **6. Webhook Registration (Updated)**
**File:** `supabase/functions/pos-oauth-callback/index.ts`

**New Webhooks Registered:**
- `orders/create` (existing)
- `orders/updated` (new)
- `draft_orders/create` (new)
- `draft_orders/update` (new) ← **Most important for credit transfer**
- `draft_orders/delete` (new)

**Auto-Registration:**
- Webhooks registered automatically during OAuth flow
- Duplicate webhooks are skipped gracefully

---

### **7. Frontend Components**

#### **A. Shopify POS Scanner Component**
**File:** `src/components/barter/ShopifyPOSScanner.tsx`

**Features:**
- Barcode scanning (camera or manual input)
- Draft order ID input
- Real-time discount application
- Success/error feedback
- Next steps instructions
- Customer credit balance display
- Troubleshooting guide

**UI Workflow:**
1. Cashier creates draft order in Shopify POS
2. Cashier opens scanner component
3. Scans customer barcode
4. Enters draft order ID from Shopify
5. Clicks "Apply Barter Discount"
6. System applies discount
7. Shows new total to charge customer
8. Cashier completes payment in Shopify POS

#### **B. Shopify POS Checkout Page**
**File:** `src/pages/ShopifyPOSCheckout.tsx`

**Route:** `/shopify-pos-checkout` (needs to be added to router)

**Purpose:** Dedicated page for cashiers to process split payments

---

## 🔄 Complete Transaction Flow

### **Step 1: Customer at Checkout**
- Customer shops normally
- Cashier scans items in Shopify POS
- POS shows total (e.g., $100)

### **Step 2: Create Draft Order**
- Cashier taps "Save order" in Shopify POS
- Shopify creates draft order
- Draft order ID is visible in Shopify (e.g., `123456789`)

### **Step 3: Customer Shows Barcode**
- Customer opens your app
- Generates fresh barcode (format: `{userId}-{timestamp}`)
- Shows barcode to cashier

### **Step 4: Cashier Scans Barcode**
- Cashier opens `ShopifyPOSScanner` component
- Scans customer barcode (or types it in)
- Enters draft order ID from Shopify
- Clicks "Apply Barter Discount"

### **Step 5: Backend Processing**
```
1. Validate barcode (not expired, not used)
2. Create payment session in database
3. Look up customer credit balance
4. Fetch draft order from Shopify API
5. Calculate barter split (total × merchant's barter %)
6. Check customer has enough credits
7. Apply discount to draft order via Shopify API
8. Update session status to "discount_applied"
9. Return success to cashier
```

### **Step 6: Cashier Completes Payment**
- Cashier sees new total on your app (e.g., $70)
- Shopify POS also shows discounted total ($70)
- Cashier processes payment (cash/card) for $70
- Payment completed in Shopify POS

### **Step 7: Webhook Finalization**
```
1. Shopify sends webhook: draft_orders/update (status: completed)
2. Backend receives webhook
3. Finds payment session by draft_order_id
4. Calls complete_pos_payment_session()
5. Debits customer $30 credits
6. Credits merchant $30 credits
7. Creates transaction record
8. Marks barcode as used
9. Updates session status to "completed"
```

### **Step 8: Customer Receipt**
- Customer receives one Shopify POS receipt
- Shows original total, barter discount, and amount paid
- Credits automatically transferred (invisible to customer)

---

## ⚙️ Configuration Required

### **1. Environment Variables**
Add to Supabase Edge Functions:
```bash
SHOPIFY_CLIENT_ID=your_api_key
SHOPIFY_CLIENT_SECRET=your_api_secret
SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
```

### **2. Shopify Partner Account**
- Create custom app with new scopes
- Configure OAuth redirect URL
- Get API credentials

### **3. Development Store**
- Create Shopify development store
- Install Shopify POS app
- Add test products
- Configure payment methods

### **4. Database Migration**
Run migration:
```bash
# Apply migration to create tables
supabase migration up
```

### **5. Deploy Edge Functions**
```bash
# Deploy shopify-apply-barter function
supabase functions deploy shopify-apply-barter

# Deploy updated pos-webhook function
supabase functions deploy pos-webhook

# Deploy updated pos-oauth-initiate function
supabase functions deploy pos-oauth-initiate

# Deploy updated pos-oauth-callback function
supabase functions deploy pos-oauth-callback
```

### **6. Router Configuration**
Add route to your React Router:
```typescript
{
  path: '/shopify-pos-checkout',
  element: <ShopifyPOSCheckout />
}
```

---

## 🧪 Testing Steps

### **1. Database Setup**
```sql
-- Verify tables created
SELECT * FROM pos_barcode_scans LIMIT 1;
SELECT * FROM pos_payment_sessions LIMIT 1;

-- Test RPC function
SELECT * FROM initiate_pos_payment_session(
  'test-user-id-123456789',
  'merchant-uuid',
  'integration-uuid'
);
```

### **2. OAuth Flow**
1. Navigate to merchant dashboard
2. Click "Connect Shopify"
3. Complete OAuth authorization
4. Verify new scopes are granted
5. Check webhooks registered (draft_orders/*)

### **3. End-to-End Test**
1. **Setup:**
   - Create test customer account with $50 credits
   - Create test merchant with 30% barter setting
   - Connect merchant's Shopify test store

2. **Create Draft Order in Shopify:**
   - Open Shopify POS (web or mobile)
   - Add products totaling $100
   - Tap "Save order" (not "Complete order")
   - Note the draft order ID

3. **Apply Barter Discount:**
   - Customer generates barcode in app
   - Cashier opens ShopifyPOSScanner
   - Scan barcode
   - Enter draft order ID
   - Click "Apply Barter Discount"
   - Verify: Shows $30 barter, $70 cash

4. **Complete Payment:**
   - Go back to Shopify POS
   - Refresh draft order (should show $70 total)
   - Complete payment with test card
   - Payment successful

5. **Verify Credit Transfer:**
   - Check `pos_payment_sessions` table (status: completed)
   - Check customer credits (should be $20 now)
   - Check merchant credits (should have gained $30)
   - Check `transactions` table (new record)

### **4. Error Scenarios**
Test these cases:
- ✅ Insufficient credits (customer has $20, needs $30)
- ✅ Expired barcode (generate barcode, wait 11 minutes)
- ✅ Used barcode (scan same barcode twice)
- ✅ Invalid draft order ID
- ✅ Draft order cancelled before payment
- ✅ Network failure during discount application

---

## 🚨 Known Limitations

1. **Draft Order Required:**
   - Cashier MUST create draft order before scanning barcode
   - Cannot work with live cart (Shopify limitation)
   - Adds one extra step to checkout

2. **Manual Draft Order ID Entry:**
   - Cashier must copy/paste draft order ID
   - Future: Automatically detect most recent draft order

3. **Shopify POS Only:**
   - Does not work with Shopify online checkout
   - Only for in-person POS transactions

4. **Single Discount:**
   - Only one barter discount per draft order
   - Cannot combine with other discount codes

5. **Credit Transfer Delay:**
   - Credits transfer AFTER payment completes
   - Typically 1-2 seconds delay (webhook processing)

---

## 🔮 Future Enhancements

### **Phase 2:**
- [ ] Auto-detect most recent draft order (eliminate manual ID entry)
- [ ] Partial barter (use whatever credits customer has)
- [ ] Barcode scanner hardware integration
- [ ] Daily limit enforcement UI

### **Phase 3:**
- [ ] Shopify POS app extension (native terminal app)
- [ ] Real-time credit balance display at POS
- [ ] Receipt customization (show barter breakdown)
- [ ] Analytics dashboard for merchants

### **Phase 4:**
- [ ] Multi-tender support (barter + gift card + cash)
- [ ] Loyalty program integration
- [ ] Customer-facing POS terminal display
- [ ] Offline mode with sync

---

## 📞 Support & Troubleshooting

### **Common Issues:**

**1. "No active Shopify integration found"**
- Merchant needs to connect Shopify via OAuth
- Check `pos_integrations` table for active record

**2. "Failed to apply discount: 404"**
- Draft order ID incorrect or doesn't exist
- Verify ID in Shopify admin

**3. "Insufficient credits"**
- Customer doesn't have enough barter balance
- Show customer their balance, ask to pay cash

**4. "Webhook not received"**
- Check `webhook_logs` table
- Verify webhook registered in Shopify
- Check Shopify webhook status in admin

**5. "Session expired"**
- Barcode older than 10 minutes
- Customer must generate new barcode

### **Debug Logging:**
All functions log to Supabase Edge Function logs:
```bash
# View logs
supabase functions logs shopify-apply-barter
supabase functions logs pos-webhook
```

### **Database Queries:**
```sql
-- View active sessions
SELECT * FROM pos_payment_sessions
WHERE session_status = 'discount_applied'
ORDER BY created_at DESC;

-- View recent barcodes
SELECT * FROM pos_barcode_scans
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- View webhooks
SELECT * FROM webhook_logs
WHERE provider = 'shopify'
AND created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;
```

---

## ✅ Deployment Checklist

Before going live:

### **Development:**
- [x] Database migration created
- [x] Edge Functions created
- [x] Frontend components created
- [x] OAuth scopes updated
- [x] Webhook handlers updated

### **Testing:**
- [ ] End-to-end test passed
- [ ] Error scenarios handled
- [ ] Webhook delivery confirmed
- [ ] Credit transfer verified
- [ ] Rollback tested

### **Production:**
- [ ] Shopify production app created
- [ ] OAuth configured with production URLs
- [ ] Environment variables set
- [ ] Database migration applied
- [ ] Edge Functions deployed
- [ ] Webhooks registered
- [ ] Router updated with new route
- [ ] Merchant documentation created
- [ ] Cashier training materials ready

### **Monitoring:**
- [ ] Error tracking configured
- [ ] Webhook monitoring enabled
- [ ] Session expiration cron job scheduled
- [ ] Analytics dashboard ready

---

## 📚 Additional Resources

- [Shopify Draft Orders API](https://shopify.dev/docs/api/admin-rest/2024-01/resources/draftorder)
- [Shopify Webhooks Guide](https://shopify.dev/docs/api/admin-rest/2024-01/resources/webhook)
- [Shopify OAuth Documentation](https://shopify.dev/docs/apps/auth/oauth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 📝 Change Log

**Version 1.0.0 - 2026-01-03**
- Initial implementation
- Shopify POS split payment support
- Draft order discount application
- Webhook-based credit transfer
- Frontend scanner component

---

**Implementation Complete!** 🎉

For questions or support, contact: [Your Contact Information]
