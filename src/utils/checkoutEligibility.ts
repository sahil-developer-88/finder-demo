import { supabase } from '@/integrations/supabase/client';
import { POSTransaction } from './posIntegration';

export interface ProductEligibility {
  name: string;
  price: number;
  quantity: number;
  totalPrice: number;
  isBarterEligible: boolean;
  restrictionReason?: string;
  categoryName?: string;
  barcode?: string;
  sku?: string;
  productId?: string;
}

export interface CheckoutSplit {
  eligibleItems: ProductEligibility[];
  restrictedItems: ProductEligibility[];
  eligibleSubtotal: number;
  restrictedSubtotal: number;
  totalSubtotal: number;
  hasRestrictedItems: boolean;
}

export interface EnhancedBarterPayment {
  eligibleSubtotal: number;
  restrictedSubtotal: number;
  totalSubtotal: number;
  barterAmount: number;
  barterPercentage: number;
  maxBarterAmount: number;
  cashForEligibleItems: number;
  cashForRestrictedItems: number;
  totalCashSubtotal: number;
  taxOnCash: number;
  taxRate: number;
  finalTotal: number;
  barterCreditsRemaining: number;
  eligibleItems: ProductEligibility[];
  restrictedItems: ProductEligibility[];
}

export async function matchProductsWithPOSItems(
  posTransaction: POSTransaction,
  merchantId: string
): Promise<CheckoutSplit> {
  const eligibleItems: ProductEligibility[] = [];
  const restrictedItems: ProductEligibility[] = [];

  for (const item of posTransaction.items) {
    try {
      if (item.barcode) {
        const { data: products, error } = await supabase
          .from('products_with_eligibility')
          .select('*')
          .eq('merchant_id', merchantId)
          .or(`barcode.eq.${item.barcode},upc.eq.${item.barcode}`)
          .limit(1);

        if (error) throw error;

        if (products && products.length > 0) {
          const dbProduct = products[0];
          const productEligibility = createProductEligibility(item, dbProduct);

          if (dbProduct.is_barter_eligible && dbProduct.barter_enabled) {
            eligibleItems.push(productEligibility);
          } else {
            restrictedItems.push({
              ...productEligibility,
              restrictionReason: dbProduct.restriction_reason ||
                               (dbProduct.category_is_restricted
                                 ? `Restricted category: ${dbProduct.category_name}`
                                 : 'Barter disabled for this product')
            });
          }
          continue;
        }
      }

      // Product not found — default to eligible (fail-safe)
      eligibleItems.push({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        isBarterEligible: true,
        barcode: item.barcode,
        categoryName: item.category
      });

    } catch (error) {
      // On error, default to eligible (fail-open for better UX)
      eligibleItems.push({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        totalPrice: item.price * item.quantity,
        isBarterEligible: true,
        barcode: item.barcode,
        categoryName: item.category
      });
    }
  }

  const eligibleSubtotal = eligibleItems.reduce((sum, item) => sum + item.totalPrice, 0);
  const restrictedSubtotal = restrictedItems.reduce((sum, item) => sum + item.totalPrice, 0);

  return {
    eligibleItems,
    restrictedItems,
    eligibleSubtotal,
    restrictedSubtotal,
    totalSubtotal: eligibleSubtotal + restrictedSubtotal,
    hasRestrictedItems: restrictedItems.length > 0
  };
}

function createProductEligibility(
  posItem: POSTransaction['items'][0],
  dbProduct: any
): ProductEligibility {
  return {
    name: dbProduct.name || posItem.name,
    price: posItem.price,
    quantity: posItem.quantity,
    totalPrice: posItem.price * posItem.quantity,
    isBarterEligible: dbProduct.is_barter_eligible && dbProduct.barter_enabled,
    categoryName: dbProduct.category_name,
    barcode: posItem.barcode,
    sku: dbProduct.sku,
    productId: dbProduct.id
  };
}

export function calculateEnhancedBarterPayment(
  checkoutSplit: CheckoutSplit,
  barterPercentage: number,
  availableBarterCredits: number,
  taxRate: number
): EnhancedBarterPayment {
  const maxBarterFromEligible = Math.min(availableBarterCredits, checkoutSplit.eligibleSubtotal);
  const barterAmount = Math.min(maxBarterFromEligible, (checkoutSplit.eligibleSubtotal * barterPercentage) / 100);
  const cashForEligibleItems = checkoutSplit.eligibleSubtotal - barterAmount;
  const cashForRestrictedItems = checkoutSplit.restrictedSubtotal;
  const totalCashSubtotal = cashForEligibleItems + cashForRestrictedItems;
  const taxOnCash = totalCashSubtotal * (taxRate / 100);
  const finalTotal = totalCashSubtotal + taxOnCash;

  return {
    eligibleSubtotal: checkoutSplit.eligibleSubtotal,
    restrictedSubtotal: checkoutSplit.restrictedSubtotal,
    totalSubtotal: checkoutSplit.totalSubtotal,
    barterAmount,
    barterPercentage,
    maxBarterAmount: maxBarterFromEligible,
    cashForEligibleItems,
    cashForRestrictedItems,
    totalCashSubtotal,
    taxOnCash,
    taxRate,
    finalTotal,
    barterCreditsRemaining: availableBarterCredits - barterAmount,
    eligibleItems: checkoutSplit.eligibleItems,
    restrictedItems: checkoutSplit.restrictedItems
  };
}

export function validateCheckout(payment: EnhancedBarterPayment): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (payment.restrictedItems.length > 0 && payment.barterAmount > payment.eligibleSubtotal) {
    errors.push('Cannot apply barter credits to restricted items');
  }

  if (payment.restrictedItems.length > 0) {
    warnings.push(
      `${payment.restrictedItems.length} restricted item(s) totaling $${payment.restrictedSubtotal.toFixed(2)} must be paid in cash only`
    );
  }

  if (payment.barterAmount > payment.maxBarterAmount) {
    errors.push('Insufficient barter credits available');
  }

  return { isValid: errors.length === 0, errors, warnings };
}
