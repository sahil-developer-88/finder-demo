import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { POSTransaction } from '@/utils/posIntegration';
import {
  matchProductsWithPOSItems,
  calculateEnhancedBarterPayment,
  validateCheckout,
  CheckoutSplit,
  EnhancedBarterPayment
} from '@/utils/checkoutEligibility';

interface UseCheckoutEligibilityReturn {
  // Data
  checkoutSplit: CheckoutSplit | null;
  payment: EnhancedBarterPayment | null;
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null;

  // State
  isLoading: boolean;
  error: string | null;

  // Methods
  recalculate: () => Promise<void>;
}

/**
 * React hook for checkout with product eligibility checking
 *
 * This hook:
 * 1. Takes a POS transaction and barter percentage
 * 2. Matches items with products in database
 * 3. Splits items into eligible vs restricted
 * 4. Calculates payment breakdown
 * 5. Validates the checkout
 * 6. Recalculates when barter percentage changes
 *
 * Usage:
 * ```tsx
 * const {
 *   checkoutSplit,
 *   payment,
 *   validation,
 *   isLoading
 * } = useCheckoutEligibility(
 *   posTransaction,
 *   barterPercentage,
 *   customerBarterBalance,
 *   taxRate
 * );
 *
 * if (validation?.warnings.length > 0) {
 *   // Show warnings about restricted items
 * }
 * ```
 *
 * @param posTransaction - Transaction from POS system
 * @param barterPercentage - Percentage to apply (0-100)
 * @param availableBarterCredits - Customer's available credits
 * @param taxRate - Tax rate percentage (default 8.25)
 */
export function useCheckoutEligibility(
  posTransaction: POSTransaction | null,
  barterPercentage: number,
  availableBarterCredits: number,
  taxRate: number = 8.25
): UseCheckoutEligibilityReturn {
  const { user } = useAuth();

  const [checkoutSplit, setCheckoutSplit] = useState<CheckoutSplit | null>(null);
  const [payment, setPayment] = useState<EnhancedBarterPayment | null>(null);
  const [validation, setValidation] = useState<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Calculate checkout split and payment
   */
  const calculate = async () => {
    if (!posTransaction || !user) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Step 1: Match POS items with database products
      const split = await matchProductsWithPOSItems(posTransaction, user.id);
      setCheckoutSplit(split);

      // Step 2: Calculate payment breakdown
      const paymentCalc = calculateEnhancedBarterPayment(
        split,
        barterPercentage,
        availableBarterCredits,
        taxRate
      );
      setPayment(paymentCalc);

      // Step 3: Validate checkout
      const validationResult = validateCheckout(paymentCalc);
      setValidation(validationResult);

    } catch (err: any) {
      console.error('❌ Error calculating checkout eligibility:', err);
      setError(err.message || 'Failed to calculate checkout eligibility');
      setCheckoutSplit(null);
      setPayment(null);
      setValidation(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Recalculate when inputs change
  useEffect(() => {
    calculate();
  }, [posTransaction, barterPercentage, availableBarterCredits, taxRate, user]);

  return {
    checkoutSplit,
    payment,
    validation,
    isLoading,
    error,
    recalculate: calculate
  };
}
