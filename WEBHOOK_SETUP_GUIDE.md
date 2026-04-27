# POS Webhook Setup Guide

This guide explains how to configure automatic product syncing from your POS system to your app using webhooks.

## How It Works

When you add, update, or delete a product in your POS system (Shopify, Square, etc.), a webhook notification is sent to your app, which automatically:
1. Creates/updates the product in your database
2. Triggers real-time UI updates on all connected devices
3. Makes the product immediately available to customers

No manual sync needed - it's instant and automatic!

---

## Shopify Setup

### Step 1: Get Your Webhook URL

Your webhook endpoint is:
```
https://[YOUR-SUPABASE-PROJECT-ID].supabase.co/functions/v1/pos-webhook?provider=shopify
```

Replace `[YOUR-SUPABASE-PROJECT-ID]` with your actual Supabase project ID.

### Step 2: Create Webhooks in Shopify Admin

1. Go to **Shopify Admin** → **Settings** → **Notifications**
2. Scroll down to **Webhooks** section
3. Click **Create webhook** for each of the following:

#### Product Created Webhook
- **Event**: `Product creation`
- **Format**: `JSON`
- **URL**: Your webhook URL from Step 1
- **API version**: Latest

#### Product Updated Webhook
- **Event**: `Product update`
- **Format**: `JSON`
- **URL**: Your webhook URL from Step 1
- **API version**: Latest

#### Product Deleted Webhook
- **Event**: `Product deletion`
- **Format**: `JSON`
- **URL**: Your webhook URL from Step 1
- **API version**: Latest

### Step 3: Set Webhook Secret (Security)

1. In your Supabase project, go to **Edge Functions** → **Secrets**
2. Add a new secret:
   - **Key**: `SHOPIFY_WEBHOOK_SECRET`
   - **Value**: Generate a strong random string (or use the one Shopify provides)

3. In Shopify webhook settings, enter the same secret in the **Webhook signature** field

### Step 4: Test the Webhook

1. In Shopify Admin, go to any product
2. Make a small change (e.g., update the description)
3. Click **Save**
4. Check your app - the product should update automatically within 1-2 seconds!

---

## Square Setup

### Step 1: Get Your Webhook URL

```
https://[YOUR-SUPABASE-PROJECT-ID].supabase.co/functions/v1/pos-webhook?provider=square
```

### Step 2: Create Webhook Subscription

1. Go to **Square Developer Dashboard** → Your Application
2. Navigate to **Webhooks** tab
3. Click **Add Endpoint**
4. Enter your webhook URL
5. Select these events:
   - `catalog.version.updated` (covers product create/update/delete)
   - `inventory.count.updated` (for stock changes)

### Step 3: Configure Signature Key

1. Copy the **Signature Key** from Square
2. Add to Supabase secrets:
   - **Key**: `SQUARE_WEBHOOK_SECRET`
   - **Value**: Your Square signature key

---

## Clover Setup

### Step 1: Get Your Webhook URL

```
https://[YOUR-SUPABASE-PROJECT-ID].supabase.co/functions/v1/pos-webhook?provider=clover
```

### Step 2: Create Webhooks

1. Go to **Clover Developer Dashboard**
2. Select your app
3. Navigate to **REST Configuration** → **Webhooks**
4. Add these webhook subscriptions:
   - `ITEM_CREATED`
   - `ITEM_UPDATED`
   - `ITEM_DELETED`
   - `INVENTORY_UPDATED`

### Step 3: Set Webhook Secret

Add to Supabase secrets:
- **Key**: `CLOVER_WEBHOOK_SECRET`
- **Value**: Your Clover webhook secret

---

## Toast Setup

### Step 1: Get Your Webhook URL

```
https://[YOUR-SUPABASE-PROJECT-ID].supabase.co/functions/v1/pos-webhook?provider=toast
```

### Step 2: Configure in Toast

1. Contact Toast support to enable webhooks for your account
2. Request these event subscriptions:
   - `menuItem.created`
   - `menuItem.updated`
   - `menuItem.deleted`

### Step 3: Set Webhook Secret

Add to Supabase secrets:
- **Key**: `TOAST_WEBHOOK_SECRET`
- **Value**: Your Toast webhook secret

---

## Verifying Webhooks Work

### Method 1: Check Logs
1. Go to **Supabase Dashboard** → **Edge Functions** → **pos-webhook**
2. Click **Logs** tab
3. You should see entries like:
   ```
   🟩 Processing Shopify webhook
   📦 Webhook topic: products/create
   ✅ Product created successfully
   ```

### Method 2: Test in Real-Time
1. Open your app's store listing page in a browser
2. In another tab, add a product in your POS system
3. Watch the store listing page - the new product should appear automatically!

### Method 3: Check Database
1. Go to **Supabase Dashboard** → **Table Editor** → **products**
2. Add a product in your POS
3. Refresh the table - you should see the new product

---

## Troubleshooting

### Webhook Not Firing

**Check:**
- Is the webhook URL correct?
- Is the webhook enabled in your POS settings?
- Check POS system's webhook delivery logs for errors

### Products Not Appearing

**Check:**
1. **Database logs**: Go to Supabase → Edge Functions → Logs
2. **Look for errors** like "Integration not found" or "Business not found"
3. **Verify**:
   - POS integration exists in `pos_integrations` table
   - You have at least one business in `businesses` table
   - The `business_id` is being set correctly

### Signature Verification Failing

**Check:**
- Webhook secret matches in both POS settings and Supabase secrets
- Secret key name is correct (e.g., `SHOPIFY_WEBHOOK_SECRET`)
- No extra spaces in the secret value

### Products Updating But UI Not Refreshing

**This should be automatic with the real-time subscriptions we just added!**

If it's not working:
1. Check browser console for errors
2. Verify real-time is enabled in Supabase settings
3. Make sure you're on the latest version of the code

---

## What Happens When You Add a Product in POS

1. **You add a product** in Shopify/Square/etc.
2. **POS sends webhook** to your Supabase Edge Function
3. **Webhook is verified** (signature check)
4. **Product is created** in `products` table with:
   - Name, price, SKU, stock quantity
   - Linked to your `business_id`
   - Category auto-created if needed
   - Image URL saved
5. **Supabase Realtime broadcasts** the change
6. **All connected clients receive update**:
   - Customer's store listing page
   - Merchant's product dashboard
   - Both update instantly without refresh!

---

## Advanced: Webhook Logs Table

All webhooks are logged for debugging:

```sql
SELECT * FROM webhook_logs
WHERE provider = 'shopify'
ORDER BY created_at DESC
LIMIT 10;
```

This shows:
- Webhook payload
- Signature verification status
- Timestamp
- Any errors

---

## Need Help?

If webhooks aren't working:
1. Check the Edge Function logs first
2. Verify the webhook is being sent (check POS delivery logs)
3. Test with a simple product create/update
4. Check database for any constraint violations

The system is designed to be resilient - if a webhook fails, you can always manually sync products using the "Sync Products" button in your dashboard!
