import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, ShoppingBag, Wrench } from 'lucide-react';

const StoreCard = ({ business, onToggleFavorite, isFavorite }: { business: any; onToggleFavorite?: (id: string) => void; isFavorite?: (id: string) => boolean }) => {
  return (
    <Link to={`/listing/${business.id}`} className="group bg-white rounded-2xl overflow-hidden border border-gray-100 hover:shadow-md transition-all">
      <div className="relative h-36 overflow-hidden">
        <img
          src={business.image}
          alt={business.businessName}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {onToggleFavorite && (
          <button
            onClick={e => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(String(business.id)); }}
            className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-sm"
          >
            <Heart className={`h-3.5 w-3.5 ${isFavorite?.(String(business.id)) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </button>
        )}
        <span className={`absolute top-2 left-2 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow ${business.businessType === 'service' ? 'bg-violet-600' : 'bg-blue-600'}`}>
          {business.businessType === 'service' ? <Wrench className="h-2.5 w-2.5" /> : <ShoppingBag className="h-2.5 w-2.5" />}
          {business.businessType === 'service' ? 'Service' : 'Product'}
        </span>
        <span className="absolute bottom-2 left-2 text-white text-[10px] font-semibold drop-shadow bg-black/30 px-1.5 py-0.5 rounded-md">
          {business.category}
        </span>
      </div>
      <div className="p-3">
        <p className="font-bold text-gray-900 text-sm truncate">{business.businessName}</p>
        <div className="flex items-center gap-1 mt-0.5 text-xs text-gray-500">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="font-medium text-gray-700">{business.rating}</span>
          <span>({business.reviews}+)</span>
          <span className="mx-1">·</span>
          <span className="text-emerald-600 font-medium">{business.barterPercentage}% Barter</span>
        </div>
      </div>
    </Link>
  );
};

export default StoreCard;
