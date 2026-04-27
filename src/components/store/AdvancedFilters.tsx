import React, { useState } from 'react';
import { SlidersHorizontal, X, ChevronDown } from 'lucide-react';

export interface FilterState {
  minBarter: number;
  businessType: 'all' | 'product' | 'service';
  minRating: number;
  location: string;
}

export const DEFAULT_FILTERS: FilterState = {
  minBarter: 0,
  businessType: 'all',
  minRating: 0,
  location: '',
};

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
}

const BARTER_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '20%+', value: 20 },
  { label: '50%+', value: 50 },
  { label: '100%', value: 100 },
];

const TYPE_OPTIONS: { label: string; value: FilterState['businessType'] }[] = [
  { label: 'All', value: 'all' },
  { label: 'Products', value: 'product' },
  { label: 'Services', value: 'service' },
];

const RATING_OPTIONS = [
  { label: 'Any', value: 0 },
  { label: '3+', value: 3 },
  { label: '4+', value: 4 },
  { label: '4.5+', value: 4.5 },
];

const isActive = (f: FilterState) =>
  f.minBarter > 0 || f.businessType !== 'all' || f.minRating > 0 || f.location.trim() !== '';

const activeCount = (f: FilterState) =>
  [f.minBarter > 0, f.businessType !== 'all', f.minRating > 0, f.location.trim() !== ''].filter(Boolean).length;

const AdvancedFilters = ({ filters, onChange }: Props) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<FilterState>(filters);
  const count = activeCount(filters);

  const handleOpen = () => { setDraft(filters); setOpen(true); };
  const handleApply = () => { onChange(draft); setOpen(false); };
  const handleClear = () => { const f = DEFAULT_FILTERS; setDraft(f); onChange(f); setOpen(false); };

  return (
    <div className="relative">
      {/* Trigger button */}
      <button
        onClick={handleOpen}
        className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
          count > 0
            ? 'bg-gray-900 text-white border-gray-900'
            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
        }`}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {count > 0 && (
          <span className="w-4 h-4 rounded-full bg-white text-gray-900 text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />

          <div className="absolute left-0 top-10 z-40 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 space-y-5">

            {/* Barter % */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Barter %</p>
              <div className="flex gap-2 flex-wrap">
                {BARTER_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setDraft(d => ({ ...d, minBarter: o.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      draft.minBarter === o.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Business type */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Business Type</p>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setDraft(d => ({ ...d, businessType: o.value }))}
                    className={`flex-1 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      draft.businessType === o.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Min Rating</p>
              <div className="flex gap-2 flex-wrap">
                {RATING_OPTIONS.map(o => (
                  <button
                    key={o.value}
                    onClick={() => setDraft(d => ({ ...d, minRating: o.value }))}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                      draft.minRating === o.value
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    {o.value === 0 ? 'Any' : `⭐ ${o.label}`}
                  </button>
                ))}
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Location</p>
              <input
                type="text"
                placeholder="City or area..."
                value={draft.location}
                onChange={e => setDraft(d => ({ ...d, location: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClear}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
              <button
                onClick={handleApply}
                className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* Active filter chips */}
      {isActive(filters) && (
        <div className="flex gap-2 flex-wrap mt-2">
          {filters.minBarter > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              Barter {filters.minBarter === 100 ? '100%' : `${filters.minBarter}%+`}
              <button onClick={() => onChange({ ...filters, minBarter: 0 })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.businessType !== 'all' && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              {filters.businessType === 'product' ? 'Products' : 'Services'}
              <button onClick={() => onChange({ ...filters, businessType: 'all' })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.minRating > 0 && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              ⭐ {filters.minRating}+
              <button onClick={() => onChange({ ...filters, minRating: 0 })}><X className="h-3 w-3" /></button>
            </span>
          )}
          {filters.location.trim() && (
            <span className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-200">
              📍 {filters.location}
              <button onClick={() => onChange({ ...filters, location: '' })}><X className="h-3 w-3" /></button>
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default AdvancedFilters;
