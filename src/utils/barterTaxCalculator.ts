/**
 * Barter Tax Calculator (V1)
 *
 * IRS rules for barter income (Publication 525):
 * - All barter income is taxable at Fair Market Value (FMV) in the year received.
 * - FMV for credits = face dollar value (1 credit = $1 USD).
 * - Reported on Form 1099-B when total income ≥ $600 from a single exchange.
 * - Self-employed barterers also owe self-employment (SE) tax on net income.
 *
 * This module provides deterministic, stateless estimates only.
 * Always recommend consulting a tax professional.
 */

// ── Constants ────────────────────────────────────────────────────────────────

/** IRS 1099-B threshold (2024 / 2025) */
export const REPORTING_THRESHOLD = 600;

/** SE tax rate: 15.3% on net SE income (SS 12.4% + Medicare 2.9%) */
const SE_TAX_RATE = 0.153;

/** SE tax is applied to 92.35% of net income (accounts for deductible half of SE tax) */
const SE_NET_FACTOR = 0.9235;

/** SS wage base limit 2025 */
const SS_WAGE_BASE = 168_600;

/** 2024 federal tax brackets (single filer). Rates: 10/12/22/24/32/35/37% */
const FEDERAL_BRACKETS_SINGLE = [
  { limit: 11_600,  rate: 0.10 },
  { limit: 47_150,  rate: 0.12 },
  { limit: 100_525, rate: 0.22 },
  { limit: 191_950, rate: 0.24 },
  { limit: 243_725, rate: 0.32 },
  { limit: 609_350, rate: 0.35 },
  { limit: Infinity, rate: 0.37 },
];

/** Standard deduction 2024 (single) */
const STANDARD_DEDUCTION = 14_600;

// ── Types ────────────────────────────────────────────────────────────────────

export interface BarterTaxInput {
  /** Total barter income received this year (credits = FMV in USD) */
  grossBarterIncome: number;
  /** Business expenses directly related to barter activities */
  barterExpenses: number;
  /** Other non-barter income (for bracket estimation) */
  otherIncome?: number;
  /** Filing status — only 'single' implemented for V1 */
  filingStatus?: 'single';
}

export interface BarterTaxEstimate {
  grossBarterIncome:   number;
  barterExpenses:      number;
  netBarterIncome:     number;
  seTaxBase:           number;
  seTaxOwed:           number;
  /** Deductible half of SE tax (reduces AGI) */
  seDeduction:         number;
  /** Estimated federal income tax on barter income (based on bracket position) */
  federalTaxOnBarter:  number;
  totalEstimatedTax:   number;
  /** Suggested quarterly estimated payment */
  quarterlyPayment:    number;
  effectiveRate:       number;
  requires1099:        boolean;
  /** Next quarterly due dates */
  quarterlyDueDates:   string[];
}

// ── Core calculator ──────────────────────────────────────────────────────────

/**
 * Estimate taxes owed on barter income for the current tax year.
 * All figures are estimates — not tax advice.
 */
export function estimateBarterTax(input: BarterTaxInput): BarterTaxEstimate {
  const {
    grossBarterIncome,
    barterExpenses,
    otherIncome = 0,
  } = input;

  const netBarterIncome = Math.max(0, grossBarterIncome - barterExpenses);

  // Self-employment tax
  // SE tax base = net income × 92.35% (but capped at SS wage base for SS portion)
  const seTaxBase = netBarterIncome * SE_NET_FACTOR;
  const ssBase    = Math.min(seTaxBase, SS_WAGE_BASE);
  const ssTax     = ssBase * 0.124;
  const medTax    = seTaxBase * 0.029;
  const seTaxOwed = ssTax + medTax;

  // Deductible half of SE tax (per IRS, you can deduct 50%)
  const seDeduction = seTaxOwed * 0.5;

  // Federal income tax estimate
  // AGI = other income + net barter income − SE deduction − standard deduction
  const agi = Math.max(0, otherIncome + netBarterIncome - seDeduction - STANDARD_DEDUCTION);
  const federalTotal      = computeFederalTax(agi, FEDERAL_BRACKETS_SINGLE);
  const federalWithoutBarter = computeFederalTax(
    Math.max(0, otherIncome - seDeduction - STANDARD_DEDUCTION),
    FEDERAL_BRACKETS_SINGLE,
  );
  const federalTaxOnBarter = Math.max(0, federalTotal - federalWithoutBarter);

  const totalEstimatedTax = seTaxOwed + federalTaxOnBarter;
  const quarterlyPayment  = totalEstimatedTax / 4;

  const effectiveRate =
    netBarterIncome > 0 ? (totalEstimatedTax / netBarterIncome) * 100 : 0;

  return {
    grossBarterIncome,
    barterExpenses,
    netBarterIncome,
    seTaxBase,
    seTaxOwed,
    seDeduction,
    federalTaxOnBarter,
    totalEstimatedTax,
    quarterlyPayment,
    effectiveRate,
    requires1099: grossBarterIncome >= REPORTING_THRESHOLD,
    quarterlyDueDates: getQuarterlyDueDates(new Date().getFullYear()),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeFederalTax(
  taxableIncome: number,
  brackets: typeof FEDERAL_BRACKETS_SINGLE,
): number {
  if (taxableIncome <= 0) return 0;
  let tax    = 0;
  let prev   = 0;
  for (const { limit, rate } of brackets) {
    if (taxableIncome <= prev) break;
    const slice = Math.min(taxableIncome, limit) - prev;
    tax  += slice * rate;
    prev  = limit;
    if (taxableIncome <= limit) break;
  }
  return tax;
}

/**
 * Returns the four IRS quarterly estimated-tax due dates for a given year.
 * Q1: Apr 15, Q2: Jun 16 (≈15), Q3: Sep 15, Q4: Jan 15 next year.
 */
function getQuarterlyDueDates(year: number): string[] {
  return [
    `April 15, ${year}`,
    `June 16, ${year}`,
    `September 15, ${year}`,
    `January 15, ${year + 1}`,
  ];
}

/** Format a number as USD string */
export function usd(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style:    'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}
