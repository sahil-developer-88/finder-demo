import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star } from 'lucide-react';

const FeaturedCard = ({ business, onToggleFavorite, isFavorite }: { business: any; onToggleFavorite?: (id: string) => void; isFavorite?: (id: string) => boolean }) => {
  return (
    <Link
      to={`/listing/${business.id}`}
      className="flex-shrink-0 w-64 bg-white rounded-2xl overflow-hidden hover:shadow-lg transition-all group border border-gray-100"
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={business.image}
          alt={business.businessName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {business.barterPercentage >= 50 && (
          <span className="absolute top-2 left-2 bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md">
            {business.barterPercentage}% Barter
          </span>
        )}
        {onToggleFavorite && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(String(business.id)); }}
            className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-transform"
          >
            <Heart className={`h-3.5 w-3.5 ${isFavorite?.(String(business.id)) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </button>
        )}
      </div>
      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm truncate">{business.businessName}</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-medium text-gray-700">{business.rating}</span>
          <span>({business.reviews}+)</span>
          <span className="mx-1">·</span>
          <span className="text-emerald-600 font-medium">$0 Trade Fee</span>
        </div>
        <p className="text-xs text-gray-400 mt-0.5 truncate">{business.location || 'Near you'}</p>
      </div>
    </Link>
  );
};

export default FeaturedCard;
