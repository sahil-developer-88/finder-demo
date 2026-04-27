import React from 'react';
import { Check, Building2, Wrench, Phone, FileText, CreditCard } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  totalSteps: number;
  steps: string[];
}

const STEP_ICONS = [Building2, Wrench, Phone, FileText, CreditCard];

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({ currentStep, totalSteps, steps }) => {
  const progressPct = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full">

      {/* Step indicators */}
      <div className="relative flex items-center justify-between mb-6">

        {/* Background track */}
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-gray-200 z-0" />

        {/* Filled track */}
        <div
          className="absolute left-0 top-5 h-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 z-0 transition-all duration-500 ease-in-out"
          style={{ width: `${progressPct}%` }}
        />

        {steps.map((label, index) => {
          const stepNum = index + 1;
          const isCompleted = stepNum < currentStep;
          const isActive    = stepNum === currentStep;
          const Icon        = STEP_ICONS[index] ?? Building2;

          return (
            <div key={index} className="relative z-10 flex flex-col items-center gap-2">

              {/* Circle */}
              <div className={`
                w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                ${isCompleted
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-600 border-indigo-600 shadow-lg shadow-indigo-200'
                  : isActive
                    ? 'bg-white border-indigo-600 shadow-lg shadow-indigo-100'
                    : 'bg-white border-gray-200'
                }
              `}>
                {isCompleted ? (
                  <Check className="h-4 w-4 text-white" strokeWidth={3} />
                ) : (
                  <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-600' : 'text-gray-300'}`} />
                )}
              </div>

              {/* Label */}
              <span className={`text-xs font-medium transition-colors duration-300 hidden sm:block ${
                isCompleted ? 'text-indigo-600'
                : isActive   ? 'text-indigo-600'
                : 'text-gray-400'
              }`}>
                {label}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
};

export default OnboardingProgress;
