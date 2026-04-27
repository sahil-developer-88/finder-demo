import React from 'react';
import { Banner } from '@/constants/storeCategories';

interface PromoBannersProps {
  banners: Banner[];
}

const PromoBanners = ({ banners }: PromoBannersProps) => {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {banners.map((promo, i) => (
          <div key={i} className={`${promo.bg} rounded-2xl p-4 flex flex-col justify-between min-h-[120px] relative overflow-hidden`}>
            <div className={`absolute -right-6 -top-6 w-24 h-24 ${promo.imgBg} rounded-full opacity-50`} />
            <div className="absolute -right-3 bottom-0 w-16 h-16 bg-white/10 rounded-full" />
            <div className="relative">
              <p className="text-white font-bold text-sm leading-snug">{promo.title}</p>
              <p className="text-white/70 text-xs mt-0.5">{promo.sub}</p>
              <p className="text-white/50 text-[10px] mt-1">{promo.expires}</p>
            </div>
            <button className="relative mt-3 self-start flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-all">
              {promo.cta} →
            </button>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mb-6">Terms apply. <span className="underline cursor-pointer">Learn more</span></p>
    </>
  );
};

export default PromoBanners;
