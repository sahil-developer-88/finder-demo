
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Calculator, Info, AlertTriangle, Calendar } from 'lucide-react';
import {
  estimateBarterTax,
  usd,
  REPORTING_THRESHOLD,
} from '@/utils/barterTaxCalculator';

interface Props {
  /** Pre-fill gross income from transaction history */
  prefillGrossIncome?: number;
  /** Pre-fill expenses from transaction history */
  prefillExpenses?: number;
}

const BarterTaxEstimator = ({ prefillGrossIncome = 0, prefillExpenses = 0 }: Props) => {
  const [grossIncome, setGrossIncome] = useState(prefillGrossIncome.toFixed(2));
  const [expenses, setExpenses]       = useState(prefillExpenses.toFixed(2));
  const [otherIncome, setOtherIncome] = useState('0');

  const gross   = parseFloat(grossIncome)  || 0;
  const exp     = parseFloat(expenses)     || 0;
  const other   = parseFloat(otherIncome)  || 0;
  const estimate = estimateBarterTax({
    grossBarterIncome: gross,
    barterExpenses:    exp,
    otherIncome:       other,
  });

  return (
    <div className="space-y-6">
      {/* Explanation banner */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 text-sm">
          <strong>IRS Rule:</strong> Barter income is taxable at <em>Fair Market Value</em> in the year
          received. 1 barter credit = $1 USD for tax purposes (IRS Pub. 525).
          Estimates below are for guidance only — consult a tax professional.
        </AlertDescription>
      </Alert>

      {/* Inputs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calculator className="w-4 h-4" />
            Tax Inputs
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="gross">Gross Barter Income ($)</Label>
            <Input
              id="gross"
              type="number"
              step="0.01"
              min="0"
              value={grossIncome}
              onChange={(e) => setGrossIncome(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">Credits received (FMV = face value)</p>
          </div>
          <div>
            <Label htmlFor="expenses">Barter-Related Expenses ($)</Label>
            <Input
              id="expenses"
              type="number"
              step="0.01"
              min="0"
              value={expenses}
              onChange={(e) => setExpenses(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">Deductible business costs</p>
          </div>
          <div>
            <Label htmlFor="other">Other Income ($)</Label>
            <Input
              id="other"
              type="number"
              step="0.01"
              min="0"
              value={otherIncome}
              onChange={(e) => setOtherIncome(e.target.value)}
              className="mt-1"
            />
            <p className="text-xs text-gray-400 mt-1">Wages, freelance, etc. (for bracket)</p>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estimated Tax Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {estimate.requires1099 && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800 text-sm">
                Income exceeds <strong>{usd(REPORTING_THRESHOLD)}</strong> — a Form 1099-B
                will be issued. Report this income on your tax return.
              </AlertDescription>
            </Alert>
          )}

          {/* Income summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 border border-green-100 rounded-lg p-3">
              <p className="text-xs text-green-700 font-medium">Gross Barter Income</p>
              <p className="text-xl font-bold text-green-800">{usd(estimate.grossBarterIncome)}</p>
              <p className="text-xs text-green-600">Taxable at FMV</p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="text-xs text-blue-700 font-medium">Net Barter Income</p>
              <p className="text-xl font-bold text-blue-800">{usd(estimate.netBarterIncome)}</p>
              <p className="text-xs text-blue-600">After expenses</p>
            </div>
          </div>

          <Separator />

          {/* Tax line items */}
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">SE tax base (net × 92.35%)</span>
              <span className="font-mono">{usd(estimate.seTaxBase)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Self-employment tax (15.3%)</span>
              <span className="font-mono text-orange-700">{usd(estimate.seTaxOwed)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">SE deduction (½ of SE tax)</span>
              <span className="font-mono text-green-700">−{usd(estimate.seDeduction)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Est. federal income tax on barter</span>
              <span className="font-mono text-orange-700">{usd(estimate.federalTaxOnBarter)}</span>
            </div>

            <Separator />

            <div className="flex justify-between font-semibold text-base">
              <span>Total estimated tax</span>
              <span className="text-red-700">{usd(estimate.totalEstimatedTax)}</span>
            </div>
            <div className="flex justify-between text-gray-500">
              <span>Effective rate on net income</span>
              <span>{estimate.effectiveRate.toFixed(1)}%</span>
            </div>
          </div>

          <Separator />

          {/* Quarterly payments */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-purple-600" />
              <p className="font-medium text-sm">Quarterly Estimated Payments</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {estimate.quarterlyDueDates.map((date, i) => (
                <div key={i} className="bg-purple-50 border border-purple-100 rounded-lg p-2 text-center">
                  <p className="text-xs text-purple-600 font-medium">Q{i + 1} Due</p>
                  <p className="text-xs text-gray-600">{date}</p>
                  <p className="text-sm font-bold text-purple-800">{usd(estimate.quarterlyPayment)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* How barter is taxed */}
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">How barter income is taxed</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Taxed at fair market value in the year received (IRS Pub. 525)</li>
              <li>Self-employed? SE tax (15.3%) applies to net barter income</li>
              <li>Deduct ½ of SE tax from gross income when computing federal tax</li>
              <li>Standard deduction (${(14_600).toLocaleString()}) reduces taxable income</li>
              <li>1099-B issued when gross income ≥ ${REPORTING_THRESHOLD} from one exchange</li>
              <li>Pay quarterly estimates to avoid underpayment penalties</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BarterTaxEstimator;
