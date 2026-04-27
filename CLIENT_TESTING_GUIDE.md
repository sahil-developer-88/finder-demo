# Barter Network Platform
## Complete Testing Guide for Client

**Document Version:** 1.0
**Date:** December 23, 2025
**Prepared for:** Client Testing & Acceptance

---

## Table of Contents

1. Introduction
2. What's New in This Release
3. Complete Testing Journey
4. Testing Checklist
5. Reporting Issues
6. Sign-Off

---

## 1. Introduction

This document guides you through testing your Barter Network platform from start to finish. Follow each step to verify all features are working correctly.

**Time Required:** 30-45 minutes
**What You'll Need:**
- Computer with internet access
- Email address for testing
- POS system credentials (Square, Shopify, Clover, or Lightspeed)

---

## 2. What's New in This Release

### ✅ Security Enhancements
- **OAuth Token Encryption** - Your POS credentials are now encrypted in the database
- **Automatic Token Refresh** - System automatically refreshes expired tokens
- **Webhook Security** - Only legitimate POS requests are accepted
- **Credit Protection** - Prevents customers from overdrawing credits
- **Data Privacy** - Merchants can only see their own data

### ✅ User Experience Improvements
- **Real-Time Product Sync Progress** - See live updates while syncing products
- **Step-by-Step Checkout Progress** - Know exactly what's happening during checkout
- **Better Error Messages** - Clear, helpful errors instead of technical jargon
- **Consistent Navigation** - Navigation bar on every page with cart badge

---

## 3. Complete Testing Journey

### STEP 1: Sign Up & Registration (5 minutes)

#### A. Create Account

1. Open the application in your browser
2. Click **"Sign In"** button (top-right corner)
3. Click **"Sign Up"** tab
4. Fill in the form:
   - Email: `testmerchant@example.com`
   - Password: `SecurePass123!`
5. Click **"Sign Up"** button

**✅ Expected Result:**
- Account created successfully
- Email confirmation sent to your inbox
- Redirected to onboarding page

#### B. Confirm Email

1. Check your email inbox
2. Find email from Barter Network
3. Click the confirmation link
4. Return to the application

**✅ Expected Result:**
- Email marked as confirmed
- Can proceed with onboarding

---

### STEP 2: Complete Onboarding (10 minutes)

#### A. Business Information

1. Enter your business details:
   - **Business Name:** Test Barter Shop
   - **Business Type:** Select from dropdown
   - **Phone:** (555) 123-4567
   - **Address:** 123 Main St, City, State, ZIP
2. Click **"Continue"**

**✅ Expected Result:**
- Form validates all fields
- Moves to next step

#### B. Set Barter Percentage

1. Set your barter percentage: `30%`
   - You can set anywhere from 0% to 100%
   - This determines what percentage of sales earn you barter credits
2. Click **"Continue"**

**✅ Expected Result:**
- Percentage saved
- Moves to contact review

#### C. Review Contact Information

1. Review all entered information
2. Make any corrections if needed
3. Click **"Continue"**

**✅ Expected Result:**
- All information displayed correctly
- Can edit by clicking "Back"

#### D. Connect POS System

1. Select your POS system:
   - Square
   - Shopify
   - Clover
   - Lightspeed
   - Toast
2. Click **"Connect [POS Name]"**

**✅ Expected Result:**
- Redirects to POS login page

#### E. Complete OAuth Connection

1. Log into your POS account
2. Review requested permissions
3. Click **"Authorize"** or **"Allow"**
4. Wait for redirect back to Barter Network

**✅ Expected Result:**
- Shows success message: "Successfully Connected to [POS]"
- Redirected to Dashboard
- POS integration shows as "Active"

---

### STEP 3: Sync Products (10 minutes)

#### A. Navigate to Products

1. Click **"Products"** in the navigation bar
2. OR go to `/products` page

**✅ Expected Result:**
- Products page loads
- Shows statistics: Total Products, Barter Enabled, Restricted, Out of Stock

#### B. Start Product Sync

1. Select your POS system from dropdown (top-right)
2. Click **"Sync Products"** button

#### C. ⭐ Watch Real-Time Progress (NEW FEATURE!)

The system now shows you live progress:

**You will see:**
- Blue progress bar (0% → 100%)
- Live counter: "45/300 products synced"
- Current step: "Syncing 300 products from Square..."
- Product name being processed
- Breakdown:
  - ✓ Synced: 280 products
  - ⊘ Skipped: 15 products
  - ✗ Errors: 5 products

**✅ Expected Results:**
- Progress bar fills up smoothly
- Counter updates in real-time
- Current product name changes
- Final success message appears
- Products appear in table below

#### D. Review Synced Products

Check the products table shows:
- Product image (if available)
- Product name
- Price
- Stock quantity
- SKU
- Category
- Barter status: **✓ Enabled** or **✗ Disabled**
- POS provider name
- Last sync date
- **"Add to Cart"** button

#### E. Test Filters

1. **Search:** Type product name in search box
2. **Filter:** Select "Barter Enabled" or "Barter Disabled"
3. **Categories:** Scroll to bottom, toggle category restrictions

**✅ Expected Results:**
- Search filters products correctly
- Filters work instantly
- Category toggles update product barter status

---

### STEP 4: Test Regular Customer Checkout (10 minutes)

#### A. Add Products to Cart

1. On Products page, click **"Add to Cart"** for 2-3 products
2. Watch for toast notification: "Added to Cart"
3. **Notice the cart badge** appears in navigation (top-right)
4. Badge shows number of items

**✅ Expected Results:**
- Toast notification for each product added
- Cart badge appears and shows correct count (e.g., "3")
- Badge is clickable

#### B. Go to Checkout

1. Click the **cart badge** in navigation
2. OR go to `/checkout` page

**✅ Expected Result:**
- Checkout page loads
- Shows two checkout options

#### C. Select Regular Customer

1. Click **"Regular Customer Checkout"** button
2. Review the totals:
   - **Subtotal:** Sum of all items
   - **Cash Amount:** What customer pays
   - **Barter Amount:** Credits you earn
   - **Tax:** Applied to cash
   - **Final Total:** Total customer pays

#### D. ⭐ Complete Sale & Watch Progress (NEW FEATURE!)

1. Click **"Complete Sale - Collect $XX.XX"** button

2. **Watch the step-by-step progress:**

```
Processing Checkout...

✓ Validating Cart [Done]
  Checking product availability and pricing...

⟳ Checking Eligibility [In Progress]
  Verifying barter eligibility and credit balance...

○ Processing Payment [Pending]
  Creating transaction and updating balances...

○ Syncing to POS [Pending]
  Updating your point-of-sale system...

✓ Complete [Done]
```

**✅ Expected Results:**
- Each step shows with icon:
  - ✓ = Completed (green)
  - ⟳ = In Progress (blue spinner)
  - ○ = Pending (gray)
- All steps complete in order
- Success message appears:
  - "Transaction Complete!"
  - "Customer paid $XX.XX. You earned $YY.YY barter credits."
- Cart clears automatically
- Your barter balance increases

#### E. Verify Transaction

1. Go to **Dashboard**
2. Find **"Recent Transactions"** section
3. Locate your test transaction

**✅ Expected Results:**
- Transaction appears in list
- Shows correct amount, date, credits earned
- Status: Completed

---

### STEP 5: Test Barter Member Checkout (15 minutes)

#### A. Setup Test Customer

**In a separate browser (or incognito window):**

1. Sign up as a customer: `testcustomer@example.com`
2. Complete registration
3. Note the customer's QR code or customer ID

**As Admin (you'll need database or admin access):**
- Add test credits to customer: $50.00

#### B. Merchant: Prepare Checkout

1. Return to your merchant account
2. Go to **Products** page
3. Add items to cart (total around $20-30)
4. Go to **Checkout**

#### C. Select Barter Member Checkout

1. Click **"Barter Member Checkout"**
2. Enter customer code (or scan QR)
3. Click **"Continue"**

**✅ Expected Results:**
- Customer information loads:
  - Customer name
  - Available credits: $50.00
- Totals recalculate:
  - Shows cash amount
  - Shows barter amount (deducted from credits)

#### D. ⭐ Complete Barter Sale & Watch Progress

1. Review totals:
   - Cash portion (customer pays)
   - Barter portion (deducted from credits)

2. Click **"Complete Sale - Collect $XX.XX"**

3. **Watch progress steps** (same as regular checkout)

**✅ Expected Results:**
- All steps complete successfully
- Success message shows:
  - "[Customer Name] paid $XX.XX cash + $YY.YY barter credits"
- **Customer credits** decrease: $50 → $30 (example)
- **Your credits** increase
- Transaction recorded

#### E. Verify Credit Balances

1. **Check customer account:**
   - Log in as customer
   - Verify credits deducted correctly

2. **Check merchant account:**
   - Your credits increased correctly

**✅ Expected Results:**
- Customer balance: $50 - $20 = $30 ✓
- Merchant balance: Increased by $20 ✓
- Math adds up correctly

---

### STEP 6: Test Error Handling (10 minutes)

#### A. ⭐ Test Insufficient Credits Error (NEW!)

1. Customer has $10 credits
2. Add $30 worth of products to cart
3. Try to checkout

**Expected Error Message:**
```
Title: Insufficient Credits
Message: You don't have enough barter credits for this
         purchase. Please add more credits or remove
         items from your cart.
```

**✅ Pass Criteria:**
- Message is clear and helpful (not technical)
- Explains the problem
- Suggests solutions

#### B. ⭐ Test Network Error (NEW!)

1. Disconnect internet
2. Try to sync products

**Expected Error Message:**
```
Title: Connection Problem
Message: Unable to connect to the server. Please check
         your internet connection and try again.
[Retry Button]
```

**✅ Pass Criteria:**
- User-friendly message
- Includes actionable button
- No technical jargon

#### C. ⭐ Test Expired Connection (NEW!)

1. If POS connection expires
2. Try to sync products

**Expected Error Message:**
```
Title: Connection Expired
Message: Your Square connection has expired. Please
         reconnect to continue syncing products.
[Reconnect Now Button]
```

**✅ Pass Criteria:**
- Clearly states what's wrong
- Provides solution (Reconnect button)
- Names the specific POS system

---

## 4. Testing Checklist

### Setup & Onboarding
- [ ] Create account successfully
- [ ] Email confirmation works
- [ ] Complete all onboarding steps
- [ ] Business information saves
- [ ] Barter percentage (0-100%) saves
- [ ] POS OAuth connection successful
- [ ] Redirect to dashboard after onboarding

### Navigation Bar (NEW!)
- [ ] Navigation visible on ALL pages
- [ ] "Dashboard" link works
- [ ] "Products" link works
- [ ] "Cart" badge appears when items added
- [ ] Cart badge shows correct item count
- [ ] Cart badge is clickable
- [ ] "Admin" link visible (if admin user)
- [ ] "Sign Out" button works

### Product Sync
- [ ] Select POS from dropdown
- [ ] Click "Sync Products"
- [ ] ⭐ **Progress bar appears and animates**
- [ ] ⭐ **Counter updates: "X/Y products"**
- [ ] ⭐ **Current product name displays**
- [ ] ⭐ **Shows: Synced / Skipped / Errors**
- [ ] Success message appears
- [ ] Products load in table
- [ ] Product details accurate
- [ ] Barter status correct
- [ ] Search filter works
- [ ] Category filter works

### Regular Checkout
- [ ] Add products to cart
- [ ] Cart badge updates
- [ ] Navigate to checkout
- [ ] Select "Regular Customer"
- [ ] Totals calculate correctly
- [ ] Click "Complete Sale"
- [ ] ⭐ **Step 1: Validating Cart ✓**
- [ ] ⭐ **Step 2: Checking Eligibility ✓**
- [ ] ⭐ **Step 3: Processing Payment ✓**
- [ ] ⭐ **Step 4: Syncing to POS ✓**
- [ ] ⭐ **All steps complete in order**
- [ ] Success message appears
- [ ] Credits increase
- [ ] Transaction in history
- [ ] Cart clears

### Barter Member Checkout
- [ ] Create customer account
- [ ] Add test credits to customer
- [ ] Add products to cart (merchant)
- [ ] Select "Barter Member"
- [ ] Enter customer code
- [ ] Customer info loads
- [ ] Credits display correctly
- [ ] Totals show cash + barter split
- [ ] ⭐ **Checkout progress steps show**
- [ ] Success message with details
- [ ] Customer credits deducted
- [ ] Merchant credits increased
- [ ] Balances accurate

### Error Messages (NEW!)
- [ ] ⭐ **Insufficient credits = friendly error**
- [ ] ⭐ **Network error = friendly error**
- [ ] ⭐ **Expired token = friendly error**
- [ ] ⭐ **All errors have action buttons**
- [ ] ⭐ **No technical jargon**

---

## 5. Reporting Issues

If you find any problems during testing:

### Issue Report Template

**Issue #:** _____

**Page/Feature:** ______________________

**Steps to Reproduce:**
1. ______________________
2. ______________________
3. ______________________

**What Happened:** ______________________

**What Should Happen:** ______________________

**Screenshot:** (attach)

**Browser & Device:** ______________________

**Priority:** ☐ Critical  ☐ High  ☐ Medium  ☐ Low

---

## 6. Client Sign-Off

### Testing Summary

**Tested By:** ______________________

**Date:** ______________________

**Browser Used:** ______________________

**Device/OS:** ______________________

### Results

**Total Tests:** _____
**Passed:** _____
**Failed:** _____

**Issues Found:** (list)
1. ______________________
2. ______________________
3. ______________________

### Acceptance

I confirm that I have tested the features in this document and:

☐ **ACCEPT** - All features working as expected. Approved for production.

☐ **REJECT** - Issues found that need to be fixed before approval.

**Client Signature:** ______________________

**Date:** ______________________

**Comments:**
_____________________________________________
_____________________________________________
_____________________________________________

---

## Quick Reference: Key New Features

### 1. Real-Time Product Sync Progress
- Live progress bar (0% → 100%)
- Product counter (X/Y synced)
- Current product name
- Synced/Skipped/Error counts

### 2. Step-by-Step Checkout
- ✓ Validating Cart
- ✓ Checking Eligibility
- ✓ Processing Payment
- ✓ Syncing to POS
- ✓ Complete

### 3. User-Friendly Errors
- Clear problem description
- Suggested solutions
- Action buttons (Reconnect, Retry)
- No technical jargon

### 4. Navigation Enhancements
- Navigation bar on every page
- Cart badge with item count
- Quick links to key pages
- Responsive design

---

## Support Contact

**For Questions or Issues:**

Email: [your-support-email]
Phone: [your-phone]
Hours: [support-hours]

---

**End of Testing Guide**

Thank you for your thorough testing! Your feedback helps us deliver a better product.
