# Square POS Integration - Setup & Configuration Guide

## ✅ CURRENT STATUS: 90% COMPLETE

The Square integration backend is **fully implemented**. You only need to configure environment variables and set up your Square developer account.

---

## **WHAT'S ALREADY IMPLEMENTED**

### ✅ Backend Edge Functions (Supabase)
1. **`pos-webhook` handler** (`supabase/functions/pos-webhook/providers/square.ts`)
   - Receives Square webhooks
   - Verifies HMAC signatures
   - Parses payment data
   - Calculates barter split
   - Inserts transactions to database
   - Logs all activity

2. **`pos-oauth-initiate`** (`supabase/functions/pos-oauth-initiate/index.ts`)
   - Generates OAuth state token
   - Builds Square authorization URL
   - Returns auth link to frontend

3. **`pos-oauth-callback`** (`supabase/functions/pos-oauth-callback/index.ts`)
   - Handles OAuth redirect from Square
   - Exchanges authorization code for access token
   - Fetches merchant & location info from Square
   - Stores credentials in database
   - Returns to merchant dashboard

### ✅ Database Schema
- `pos_integrations` - Stores Square OAuth credentials
- `pos_transactions` - Records all Square transactions
- `webhook_logs` - Audit trail of all webhooks
- `oauth_states` - CSRF protection tokens
- All tables have RLS policies and real-time subscriptions

### ✅ React Components
- `POSConnectionWizard` - UI for connecting Square
- `MerchantDashboard` - Real-time transaction display
- `usePOSTransactions()` - Real-time data sync
- `usePOSIntegrations()` - Manage connections

### ✅ Utilities
- `calculateBarterPayment()` - Payment splitting
- `calculateTransactionSplit()` - Accurate math
- Transaction receipt formatting
- UPC product lookup

---

## **SETUP INSTRUCTIONS**

### **Step 1: Create a Square Developer Account**

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Sign up or log in
3. Create a new application
4. Note your:
   - **Application ID** (Client ID)
   - **Application Secret** (Client Secret)

### **Step 2: Get Your Credentials**

In the Square Developer Dashboard:

1. **Go to the "Credentials" tab**
   - Copy: **Application ID** → `SQUARE_OAUTH_CLIENT_ID`
   - Copy: **Application Secret** → `SQUARE_OAUTH_CLIENT_SECRET`

2. **Go to "Webhooks" tab**
   - Copy: **Signature Key** → `SQUARE_WEBHOOK_SIGNATURE_KEY`

### **Step 3: Set Up Webhook Endpoint**

In Square Developer Dashboard:

1. Go to **"Webhooks" → "Add Endpoint"**
2. Enter URL:
   ```
   https://[YOUR_SUPABASE_URL]/functions/v1/pos-webhook?provider=square
   ```
   Replace `[YOUR_SUPABASE_URL]` with your actual Supabase URL
   Example: `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-webhook?provider=square`

3. Select these events:
   - ✅ `payment.created`
   - ✅ `payment.updated`

4. Click **"Save"** and note the **Signature Key**

### **Step 4: Set Up OAuth Redirect URL**

In Square Developer Dashboard:

1. Go to **"OAuth" section**
2. Add Redirect URL:
   ```
   https://[YOUR_SUPABASE_URL]/functions/v1/pos-oauth-callback
   ```
   Example: `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-oauth-callback`

3. Save the configuration

### **Step 5: Configure Environment Variables in Supabase**

Run this in your terminal:

```bash
supabase secrets set SQUARE_OAUTH_CLIENT_ID="your_client_id"
supabase secrets set SQUARE_OAUTH_CLIENT_SECRET="your_client_secret"
supabase secrets set SQUARE_WEBHOOK_SIGNATURE_KEY="your_webhook_key"
```

Or manually in Supabase Dashboard:
1. Go to **Settings → Secrets**
2. Add:
   - `SQUARE_OAUTH_CLIENT_ID` = (your Client ID)
   - `SQUARE_OAUTH_CLIENT_SECRET` = (your Client Secret)
   - `SQUARE_WEBHOOK_SIGNATURE_KEY` = (your Webhook Signature Key)

### **Step 6: Deploy Edge Functions**

```bash
# From project root
supabase functions deploy pos-webhook
supabase functions deploy pos-oauth-initiate
supabase functions deploy pos-oauth-callback
```

---

## **HOW THE FLOW WORKS**

### **Connecting Square (User Perspective)**

```
1. Merchant clicks "Connect Square" button
        ↓
2. Frontend calls pos-oauth-initiate edge function
        ↓
3. Supabase returns Square authorization URL
        ↓
4. Merchant is redirected to Square login
        ↓
5. Merchant approves permissions
        ↓
6. Square redirects to pos-oauth-callback function
        ↓
7. Function exchanges code for access token
        ↓
8. Function fetches merchant & location info
        ↓
9. Function stores credentials in database
        ↓
10. Merchant redirected to dashboard ✅
```

### **Processing Transactions (System Perspective)**

```
1. Customer makes purchase in Square POS
        ↓
2. Square processes payment
        ↓
3. Square sends webhook to your endpoint
        ↓
4. pos-webhook function receives it
        ↓
5. Validates Square signature
        ↓
6. Parses payment data
        ↓
7. Calculates barter split (e.g., 25% barter, 75% cash)
        ↓
8. Inserts transaction to database
        ↓
9. Real-time listeners notify frontend
        ↓
10. Merchant dashboard updates automatically ✅
```

---

## **DATA FLOW**

### **Stored in Database**

When a transaction comes in, this gets saved:

```json
{
  "id": "uuid",
  "merchant_id": "user-uuid",
  "external_transaction_id": "square-payment-id",
  "pos_provider": "square",
  "total_amount": 100.00,
  "currency": "USD",
  "tax_amount": 8.00,
  "tip_amount": 5.00,
  "barter_amount": 25.00,      // 25% of $100
  "barter_percentage": 25,
  "cash_amount": 0,
  "card_amount": 75.00,         // 75% goes to card
  "location_id": "square-location-uuid",
  "transaction_date": "2024-12-03T10:30:00Z",
  "status": "completed",
  "webhook_signature": "verified-hmac",
  "raw_webhook_data": { ... }
}
```

---

## **TESTING THE INTEGRATION**

### **Option 1: Using Square's Webhook Tester**

1. In Square Developer Dashboard → "Webhooks"
2. Click **"Test Endpoint"**
3. Send test `payment.created` event
4. Check `webhook_logs` table to see if received

### **Option 2: Make a Real Transaction**

1. Connect your Square POS
2. Process a real payment
3. Check database: `SELECT * FROM pos_transactions ORDER BY created_at DESC LIMIT 1`
4. Verify data is correct

### **Option 3: Manual curl Test**

```bash
curl -X POST "https://[YOUR_SUPABASE_URL]/functions/v1/pos-webhook?provider=square" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "payment.created",
    "data": {
      "object": {
        "payment": {
          "id": "test-payment-123",
          "amount_money": { "amount": 10000, "currency": "USD" },
          "location_id": "test-location",
          "created_at": "2024-12-03T10:30:00Z"
        }
      }
    }
  }'
```

---

## **CONFIGURATION OPTIONS**

### **In POSConnectionWizard Component**

The default barter percentage is 25%, but you can customize per merchant:

```typescript
// In src/components/merchant/POSConnectionWizard.tsx
config.barterPercentage = 25  // Change this value
```

### **Per-Transaction Override**

Merchants can set different barter percentages:
- Via dashboard UI (merchant sets preference)
- At checkout (customer can adjust)
- Integration config stores merchant default

---

## **SECURITY**

✅ **All security measures implemented:**

1. **HMAC Signature Verification**
   - Every Square webhook is verified with signature
   - Invalid signatures are rejected

2. **OAuth CSRF Protection**
   - State tokens prevent OAuth attacks
   - Tokens expire after 1 hour

3. **Row Level Security (RLS)**
   - Merchants can only see their own transactions
   - Admin can see all

4. **Credentials Encryption**
   - OAuth tokens stored as encrypted in Supabase
   - Never exposed to frontend

---

## **TROUBLESHOOTING**

### **Webhooks not being received**

1. Check webhook URL is correct in Square Dashboard
2. Verify provider parameter: `?provider=square`
3. Check `webhook_logs` table for errors
4. Check Supabase function logs

```bash
supabase functions list
supabase functions logs pos-webhook
```

### **OAuth not working**

1. Verify Client ID and Secret are correct
2. Check redirect URL matches Square Dashboard settings
3. Check `oauth_states` table for tokens
4. Check function logs for errors

### **Transactions not being saved**

1. Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` is correct
2. Check if integration exists: `SELECT * FROM pos_integrations WHERE provider = 'square'`
3. Verify merchant location_id matches
4. Check function logs for errors

---

## **NEXT STEPS**

1. ✅ Set up Square Developer Account
2. ✅ Configure environment variables
3. ✅ Deploy edge functions
4. ✅ Test webhook endpoint
5. ✅ Connect first Square location
6. ✅ Process test transaction

---

## **ENVIRONMENT VARIABLES CHECKLIST**

```
SQUARE_OAUTH_CLIENT_ID = "sq0atp-xxxxxxxx..."
SQUARE_OAUTH_CLIENT_SECRET = "sq0csp-xxxxxxxx..."
SQUARE_WEBHOOK_SIGNATURE_KEY = "whsig_xxxxxxxx..."
SUPABASE_URL = "https://etzwoyyhxvwpdejckpaq.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGc..."
SUPABASE_ANON_KEY = "eyJhbGc..."
```

All set! Your Square integration is ready to go. Just configure the credentials and deploy. 🚀
