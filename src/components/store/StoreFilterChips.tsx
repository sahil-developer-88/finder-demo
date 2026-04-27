import React from 'react';
import { ChevronRight } from 'lucide-react';
import { FILTER_CHIPS } from '@/constants/storeCategories';

interface StoreFilterChipsProps {
  activeFilter: string;
  onFilterChange: (value: string) => void;
}

const StoreFilterChips = ({ activeFilter, onFilterChange }: StoreFilterChipsProps) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide mb-5">
      {FILTER_CHIPS.map(chip => {
        const Icon = (chip as any).icon;
        const active = activeFilter === chip.value;
        return (
          <button
            key={chip.value}
            onClick={() => onFilterChange(active ? '' : chip.value)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              active
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
          >
            {Icon && <Icon className="h-3 w-3" />}
            {chip.label}
            {(chip.value === 'rating' || chip.value === 'sort') && <ChevronRight className="h-3 w-3 rotate-90" />}
          </button>
        );
      })}
    </div>
  );
};

export default StoreFilterChips;
