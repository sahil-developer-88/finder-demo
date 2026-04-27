import React from 'react';
import { SIDEBAR_CATS } from '@/constants/storeCategories';

interface StoreSidebarProps {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onClearFilter: () => void;
}

const StoreSidebar = ({ selectedCategory, onSelectCategory, onClearFilter }: StoreSidebarProps) => {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col shrink-0 w-20 lg:w-52 bg-[#0f1117] border-r border-white/10 sticky top-16 self-start h-[calc(100vh-4rem)] overflow-y-auto">
        {SIDEBAR_CATS.map(cat => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => { onSelectCategory(cat.value); onClearFilter(); }}
              className={`flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              }`}
            >
              <Icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-emerald-400' : ''}`} />
              <span className="hidden lg:block truncate">{cat.label}</span>
            </button>
          );
        })}
      </aside>

      {/* Mobile bottom category bar */}
      <div className="md:hidden fixed bottom-16 left-0 right-0 bg-[#0f1117] border-t border-white/10 z-20 flex overflow-x-auto scrollbar-hide">
        {SIDEBAR_CATS.slice(0, 8).map(cat => {
          const Icon = cat.icon;
          const active = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              onClick={() => { onSelectCategory(cat.value); onClearFilter(); }}
              className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2 text-[10px] font-medium transition-colors ${active ? 'text-emerald-400' : 'text-gray-400'}`}
            >
              <Icon className={`h-5 w-5 ${active ? 'text-emerald-400' : 'text-gray-500'}`} />
              {cat.label}
            </button>
          );
        })}
      </div>
    </>
  );
};

export default StoreSidebar;
