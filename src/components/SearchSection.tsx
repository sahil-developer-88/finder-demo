import React from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, X } from "lucide-react";

interface SearchSectionProps {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  locationFilter: string;
  setLocationFilter: (value: string) => void;
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  categories: string[];
}

const CATEGORY_EMOJIS: Record<string, string> = {
  'All Categories':  '🏪',
  'Marketing':       '📣',
  'Legal':           '⚖️',
  'Design':          '🎨',
  'Technology':      '💻',
  'Health & Wellness':'🏥',
  'Consulting':      '💼',
  'Photography':     '📷',
  'Writing':         '✍️',
  'Finance':         '💰',
};

const FILTER_PILLS = [
  { label: 'Offers',           emoji: '🏷️' },
  { label: 'Highest Barter %', emoji: '%'  },
  { label: 'Nearby',           emoji: '📍' },
  { label: 'Verified',         emoji: '✓'  },
];

const SearchSection: React.FC<SearchSectionProps> = ({
  selectedCategory,
  setSelectedCategory,
  locationFilter,
  setLocationFilter,
  categories,
}) => {
  const [activeFilter, setActiveFilter] = React.useState('');

  const hasActiveFilters = selectedCategory !== 'All Categories' || locationFilter !== '' || activeFilter !== '';

  const clearAll = () => {
    setSelectedCategory('All Categories');
    setLocationFilter('');
    setActiveFilter('');
  };

  const allCategories = ['All Categories', ...categories.filter(c => c !== 'All Categories')];

  return (
    <div className="mb-6 space-y-3">

      {/* Location + clear row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Filter by location..."
            className="pl-9 rounded-xl border-gray-200 bg-white focus-visible:ring-indigo-400 text-sm"
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
          />
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearAll} className="rounded-xl text-gray-500 hover:text-gray-900 gap-1.5 px-3">
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Category chips — horizontal scroll, emoji + text style */}
      <div className="relative">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {allCategories.map((category) => {
            const isActive = selectedCategory === category;
            const emoji = CATEGORY_EMOJIS[category] ?? '🏷️';
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className="whitespace-nowrap flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 flex-shrink-0 border"
                style={{
                  background:   isActive ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'white',
                  color:        isActive ? 'white' : '#374151',
                  borderColor:  isActive ? 'transparent' : '#e5e7eb',
                  boxShadow:    isActive ? '0 4px 12px #6366f140' : undefined,
                }}
              >
                <span className="text-sm leading-none">{emoji}</span>
                {category}
              </button>
            );
          })}
        </div>
        <div className="absolute right-0 top-0 bottom-1 w-10 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
        {FILTER_PILLS.map((f) => {
          const isActive = activeFilter === f.label;
          return (
            <button
              key={f.label}
              onClick={() => setActiveFilter(isActive ? '' : f.label)}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-xs font-semibold transition-all duration-200"
              style={{
                background:  isActive ? '#0f172a' : 'white',
                color:       isActive ? 'white' : '#374151',
                borderColor: isActive ? '#0f172a' : '#e5e7eb',
              }}
            >
              <span>{f.emoji}</span>
              {f.label}
            </button>
          );
        })}
      </div>

    </div>
  );
};

export default SearchSection;
