import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';

type AdBanner = {
  id: string;
  merchant_name: string;
  image_url: string | null;
  headline: string | null;
  sub_text: string | null;
  link_url: string | null;
};

const ROTATE_MS = 7500;

const PromoBanners = () => {
  const [banners, setBanners]     = useState<AdBanner[]>([]);
  const [current, setCurrent]     = useState(0);
  const [loading, setLoading]     = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    supabase
      .from('ad_banners')
      .select('id, merchant_name, image_url, headline, sub_text, link_url')
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setBanners(data ?? []);
        setLoading(false);
      });
  }, []);

  // Auto-rotate
  useEffect(() => {
    if (banners.length <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % banners.length);
    }, ROTATE_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length]);

  const prev = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent(c => (c - 1 + banners.length) % banners.length);
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % banners.length), ROTATE_MS);
  };

  const next = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCurrent(c => (c + 1) % banners.length);
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % banners.length), ROTATE_MS);
  };

  if (loading || banners.length === 0) return null;

  const b = banners[current];

  return (
    <div className="mb-5">
      <div className="relative w-full rounded-2xl overflow-hidden bg-gray-100 border border-gray-200" style={{ height: 90 }}>
        {/* Image */}
        {b.image_url && (
          <img
            src={b.image_url}
            alt={b.merchant_name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        )}

        {/* Overlay gradient for text readability when image present */}
        {b.image_url && (
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/20" />
        )}

        {/* Text overlay */}
        <div className={`absolute inset-0 flex flex-col justify-center px-4 ${b.image_url ? 'text-white' : 'text-gray-800'}`}>
          {b.headline && <p className="text-sm font-bold leading-tight">{b.headline}</p>}
          {b.sub_text && <p className={`text-xs mt-0.5 ${b.image_url ? 'text-white/80' : 'text-gray-500'}`}>{b.sub_text}</p>}
          <p className={`text-[10px] mt-0.5 ${b.image_url ? 'text-white/50' : 'text-gray-400'}`}>{b.merchant_name}</p>
        </div>

        {/* Link */}
        {b.link_url && (
          <a
            href={b.link_url}
            target="_blank"
            rel="noreferrer"
            className="absolute top-2 right-2 bg-white/20 hover:bg-white/40 rounded-full p-1 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink className="h-3 w-3 text-white" />
          </a>
        )}

        {/* Prev / Next arrows */}
        {banners.length > 1 && (
          <>
            <button
              onClick={prev}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-0.5 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={next}
              className="absolute right-6 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-0.5 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className={`h-1.5 rounded-full transition-all ${i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50'}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sponsored label */}
      <p className="text-[10px] text-gray-400 mt-1 text-right">Sponsored</p>
    </div>
  );
};

export default PromoBanners;
