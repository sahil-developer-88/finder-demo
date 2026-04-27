/**
 * Transaction split calculator
 * Calculates how to split a transaction between barter credits and traditional payment
 */

export interface SplitResult {
  barterAmount: number;
  barterPercentage: number;
  cashAmount: number;
  cardAmount: number;
  totalAmount: number;
}

/**
 * Calculate transaction split based on merchant's barter percentage
 * 
 * @param totalAmount - Total transaction amount
 * @param barterPercentage - Percentage to apply as barter (0-100)
 * @param tipAmount - Optional tip amount (not included in barter calculation)
 * @returns Split breakdown
 */
export function calculateTransactionSplit(
  totalAmount: number,
  barterPercentage: number,
  tipAmount: number = 0
): SplitResult {
  // Validate inputs
  if (totalAmount < 0) {
    throw new Error('Total amount cannot be negative');
  }
  
  if (barterPercentage < 0 || barterPercentage > 100) {
    throw new Error('Barter percentage must be between 0 and 100');
  }

  // Calculate barter amount (excluding tip)
  const barterAmount = Math.round((totalAmount * barterPercentage / 100) * 100) / 100;
  
  // Remaining amount goes to card
  const cardAmount = Math.round((totalAmount - barterAmount) * 100) / 100;
  
  // Cash amount is 0 by default (can be customized per transaction)
  const cashAmount = 0;

  return {
    barterAmount,
    barterPercentage,
    cashAmount,
    cardAmount,
    totalAmount
  };
}

/**
 * Calculate split with custom cash amount
 */
export function calculateCustomSplit(
  totalAmount: number,
  barterAmount: number,
  cashAmount: number
): SplitResult {
  if (barterAmount + cashAmount > totalAmount) {
    throw new Error('Barter + cash cannot exceed total amount');
  }

  const cardAmount = Math.round((totalAmount - barterAmount - cashAmount) * 100) / 100;
  const barterPercentage = Math.round((barterAmount / totalAmount) * 10000) / 100;

  return {
    barterAmount,
    barterPercentage,
    cashAmount,
    cardAmount,
    totalAmount
  };
}

/**
 * Calculate split respecting daily limits
 */
export function calculateSplitWithLimits(
  totalAmount: number,
  barterPercentage: number,
  dailyBarterUsed: number,
  dailyBarterLimit: number
): SplitResult {
  // Calculate desired barter amount
  let barterAmount = Math.round((totalAmount * barterPercentage / 100) * 100) / 100;
  
  // Check if it exceeds daily limit
  const remainingDailyLimit = dailyBarterLimit - dailyBarterUsed;
  
  if (barterAmount > remainingDailyLimit) {
    barterAmount = Math.max(0, remainingDailyLimit);
  }
  
  // Recalculate actual percentage used
  const actualBarterPercentage = totalAmount > 0 
    ? Math.round((barterAmount / totalAmount) * 10000) / 100 
    : 0;
  
  const cardAmount = Math.round((totalAmount - barterAmount) * 100) / 100;

  return {
    barterAmount,
    barterPercentage: actualBarterPercentage,
    cashAmount: 0,
    cardAmount,
    totalAmount
  };
}
