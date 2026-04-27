/**
 * CheckoutProgress Component
 * Displays step-by-step loading state during checkout process
 */

import { CheckCircle, Loader2, Circle } from 'lucide-react';

export type CheckoutStep =
  | 'validating'
  | 'checking_eligibility'
  | 'processing_payment'
  | 'syncing_pos'
  | 'complete';

interface CheckoutProgressProps {
  currentStep: CheckoutStep;
  className?: string;
}

interface StepInfo {
  key: CheckoutStep;
  label: string;
  description: string;
}

const steps: StepInfo[] = [
  {
    key: 'validating',
    label: 'Validating Cart',
    description: 'Checking product availability and pricing...'
  },
  {
    key: 'checking_eligibility',
    label: 'Checking Eligibility',
    description: 'Verifying barter eligibility and credit balance...'
  },
  {
    key: 'processing_payment',
    label: 'Processing Payment',
    description: 'Creating transaction and updating balances...'
  },
  {
    key: 'syncing_pos',
    label: 'Syncing to POS',
    description: 'Updating your point-of-sale system...'
  },
  {
    key: 'complete',
    label: 'Complete',
    description: 'Transaction completed successfully!'
  }
];

export function CheckoutProgress({ currentStep, className = '' }: CheckoutProgressProps) {
  const currentStepIndex = steps.findIndex(s => s.key === currentStep);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-3">Processing Checkout...</h3>

        <div className="space-y-3">
          {steps.map((step, index) => {
            const isComplete = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isPending = index > currentStepIndex;

            // Don't show POS sync step if not reached
            if (step.key === 'syncing_pos' && currentStep !== 'syncing_pos' && currentStep !== 'complete') {
              return null;
            }

            return (
              <div
                key={step.key}
                className={`flex items-start gap-3 ${
                  isPending ? 'opacity-40' : 'opacity-100'
                }`}
              >
                {/* Icon */}
                <div className="flex-shrink-0 mt-0.5">
                  {isComplete && (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  )}
                  {isCurrent && (
                    <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                  )}
                  {isPending && (
                    <Circle className="h-5 w-5 text-gray-400" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    isCurrent ? 'text-blue-900' : isComplete ? 'text-green-900' : 'text-gray-600'
                  }`}>
                    {step.label}
                  </p>
                  {isCurrent && (
                    <p className="text-xs text-blue-700 mt-0.5">
                      {step.description}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                {isComplete && (
                  <span className="text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded">
                    Done
                  </span>
                )}
                {isCurrent && (
                  <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded animate-pulse">
                    In Progress
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
