import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import FeaturedCard from './FeaturedCard';

const HScrollSection = ({ title, businesses, loading, seeAllUrl, onToggleFavorite, isFavorite }: {
  title: string;
  businesses: any[];
  loading?: boolean;
  seeAllUrl?: string;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: (id: string) => boolean;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: dir === 'left' ? -300 : 300, behavior: 'smooth' });
  };
  if (!loading && businesses.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-gray-900">{title}</h2>
        <div className="flex items-center gap-2">
          {seeAllUrl && (
            <Link to={seeAllUrl} className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 mr-2">See all</Link>
          )}
          <button onClick={() => scroll('left')} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <button onClick={() => scroll('right')} className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors">
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
      </div>
      <div ref={scrollRef} className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden border border-gray-100 animate-pulse">
                <div className="h-40 bg-gray-100" />
                <div className="p-3 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-50 rounded w-1/2" />
                </div>
              </div>
            ))
          : businesses.map(b => <FeaturedCard key={b.id} business={b} onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />)
        }
      </div>
    </div>
  );
};

export default HScrollSection;
