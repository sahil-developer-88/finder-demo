# Square Integration - Testing & Verification Guide

## **QUICK START: Test the Integration**

Follow these steps to test your Square integration end-to-end.

---

## **Pre-Test Checklist**

- [ ] Square Developer Account created
- [ ] OAuth credentials configured in Supabase
- [ ] Webhook signature key added to Supabase
- [ ] Webhook endpoint registered in Square
- [ ] OAuth redirect URL configured in Square
- [ ] Edge functions deployed

---

## **Test 1: Verify Webhook Endpoint**

### **Using cURL**

```bash
# Test if webhook endpoint is accessible
curl -X POST "https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-webhook?provider=square" \
  -H "Content-Type: application/json" \
  -H "x-square-hmacsha256-signature: test-signature" \
  -H "x-square-hmacsha256-timestamp: $(date +%s)" \
  -d '{
    "type": "payment.created",
    "data": {
      "object": {
        "payment": {
          "id": "cnp_test_payment_123",
          "amount_money": {
            "amount": 5000,
            "currency": "USD"
          },
          "tax_money": {
            "amount": 500,
            "currency": "USD"
          },
          "tip_money": {
            "amount": 200,
            "currency": "USD"
          },
          "location_id": "square-location-uuid",
          "created_at": "2024-12-03T10:30:00Z"
        }
      }
    }
  }'
```

### **Expected Response**

```json
{
  "success": false,
  "error": "Invalid signature"
}
```

This is expected! It means:
- ✅ Webhook endpoint is accessible
- ✅ It's validating signatures
- ✅ Will accept real webhooks from Square

---

## **Test 2: Verify Database Tables**

Run these SQL queries in Supabase SQL Editor:

```sql
-- Check pos_integrations table
SELECT * FROM pos_integrations LIMIT 5;

-- Check pos_transactions table
SELECT * FROM pos_transactions LIMIT 5;

-- Check webhook_logs table
SELECT * FROM webhook_logs LIMIT 5;

-- Check oauth_states table
SELECT * FROM oauth_states WHERE expires_at > NOW() LIMIT 5;
```

Expected: Tables exist but are empty (until you process transactions)

---

## **Test 3: Test OAuth Flow (Frontend)**

### **Step 1: Open the App**

1. Go to your app's merchant dashboard
2. Look for "Connect POS" or "Add Integration" button
3. Click it

### **Step 2: Select Square**

1. POSConnectionWizard should open
2. Click "Square" button
3. Verify OAuth method is selected (should be "OAuth")

### **Step 3: Click Connect**

1. Click "Connect with Square"
2. You should be redirected to Square login
3. Log in with your Square test account

### **Step 4: Authorize**

1. Square asks to authorize "BarterEx"
2. Click "Authorize" or "Allow"
3. You should be redirected back to your app

### **Step 5: Verify Success**

1. You should see "Successfully connected!" message
2. Check database:

```sql
SELECT * FROM pos_integrations
WHERE provider = 'square'
ORDER BY created_at DESC LIMIT 1;
```

Expected output:
```
id: uuid
user_id: your-user-id
provider: square
access_token: sq0atp_xxxxxxxx (encrypted)
merchant_id: merchant-uuid-from-square
store_id: square-location-uuid
status: active
created_at: 2024-12-03T...
```

---

## **Test 4: Process a Real Transaction**

### **Step 1: Make a Sale in Square POS**

1. Open your Square Point of Sale
2. Process a real transaction
   - Amount: $100.00
   - Tip: $5.00 (optional)
   - Complete payment

### **Step 2: Wait for Webhook**

Square sends webhooks within seconds. Allow up to 30 seconds.

### **Step 3: Check Database**

```sql
SELECT
  id,
  merchant_id,
  external_transaction_id,
  total_amount,
  barter_amount,
  barter_percentage,
  cash_amount,
  status,
  created_at
FROM pos_transactions
WHERE pos_provider = 'square'
ORDER BY created_at DESC
LIMIT 1;
```

Expected output:
```
id: uuid
merchant_id: your-user-id
external_transaction_id: cnp_xxxxx (from Square)
total_amount: 100.00
barter_amount: 25.00 (25% of $100)
barter_percentage: 25
cash_amount: 0
status: completed
created_at: 2024-12-03T...
```

### **Step 4: Verify in Dashboard**

1. Go to Merchant Dashboard
2. Look for "Today's Barter Volume"
3. Should show $25.00 (the barter amount)
4. Look for transaction in transaction list
5. Should show full details

---

## **Test 5: Check Webhook Logs**

```sql
SELECT
  provider,
  status,
  error_message,
  created_at
FROM webhook_logs
WHERE provider = 'square'
ORDER BY created_at DESC
LIMIT 10;
```

Expected:
- All recent entries should have `status: 'success'`
- No error messages

---

## **Test 6: Real-Time Updates**

### **Setup**

1. Open two browser tabs
2. Tab 1: Your merchant dashboard
3. Tab 2: Keep open for reference

### **Execute**

1. Tab 1: Go to "Transactions" tab
2. Tab 2: Process a transaction in Square
3. Tab 1: Watch for the transaction to appear in real-time
4. No page refresh should be needed

Expected: Transaction appears within 2-3 seconds

---

## **Common Issues & Solutions**

### **Issue: "Integration not found"**

**Symptoms:**
- Webhook error: "Integration not found for location"

**Solution:**
1. Verify `store_id` in pos_integrations matches Square location
2. Check location_id in webhook payload matches
3. Re-connect the integration

```sql
SELECT store_id FROM pos_integrations WHERE provider = 'square';
```

---

### **Issue: "Invalid signature"**

**Symptoms:**
- All webhooks rejected with "Invalid signature"

**Solution:**
1. Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correct
2. Copy-paste exactly from Square Dashboard (no extra spaces)
3. Check in Supabase Settings → Secrets

```bash
# Verify it's set
supabase secrets list
```

---

### **Issue: OAuth redirect fails**

**Symptoms:**
- Clicking "Connect with Square" doesn't redirect
- Or redirect URL shows error

**Solution:**
1. Verify redirect URL in Square Dashboard:
   ```
   https://[YOUR_SUPABASE_URL]/functions/v1/pos-oauth-callback
   ```
2. Check it matches EXACTLY (no trailing slashes, case-sensitive)
3. Verify Client ID and Secret are correct

---

### **Issue: Transactions not appearing**

**Symptoms:**
- Square processes payment but no transaction in database
- Dashboard shows no activity

**Solution:**
1. Check webhook was received:
   ```sql
   SELECT * FROM webhook_logs WHERE provider = 'square' ORDER BY created_at DESC LIMIT 1;
   ```

2. Check error:
   ```sql
   SELECT error_message FROM webhook_logs WHERE provider = 'square' AND status = 'failed';
   ```

3. If no webhook_logs entry, webhook wasn't received:
   - Verify endpoint URL in Square
   - Check Supabase function logs:
     ```bash
     supabase functions logs pos-webhook --limit 50
     ```

4. If webhook received but no transaction:
   - Check pos_integrations has entry for your location
   - Verify merchant_id matches

---

### **Issue: Dashboard doesn't update in real-time**

**Symptoms:**
- Transaction appears in database after page refresh
- But doesn't appear automatically

**Solution:**
1. Check real-time subscription is enabled:
   ```sql
   SELECT * FROM information_schema.tables
   WHERE table_name = 'pos_transactions';
   ```

2. Verify real-time is enabled:
   ```bash
   supabase db list
   # Should show "pos_transactions" in supabase_realtime schema
   ```

3. Check browser console for connection errors
4. Hard refresh the page (Ctrl+Shift+R)

---

## **Success Criteria**

Your Square integration is working correctly when:

- [ ] OAuth connects successfully
- [ ] Credentials stored in database
- [ ] Real transactions appear in pos_transactions
- [ ] Barter amount calculated correctly (25% by default)
- [ ] Merchant dashboard updates in real-time
- [ ] All webhook_logs show success status
- [ ] Transaction data is complete and accurate

---

## **Performance Expectations**

- **Webhook latency**: 1-5 seconds from Square to your database
- **Dashboard update**: 0.5-2 seconds via real-time
- **OAuth flow**: 3-10 seconds total

---

## **Next: Deploy to Production**

Once testing passes:

1. Get real Square credentials (production account)
2. Update Supabase secrets with production values
3. Test with real Square account
4. Monitor webhook logs for 24 hours
5. Done! 🚀

---

## **Support**

If something isn't working:

1. Check webhook_logs in database
2. Check Supabase function logs: `supabase functions logs pos-webhook`
3. Verify all environment variables are set
4. Re-read SQUARE_INTEGRATION_SETUP.md
5. Check Square API status: https://status.squareup.com
