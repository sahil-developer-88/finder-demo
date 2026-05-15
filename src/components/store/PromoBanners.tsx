import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type AdBanner = {
  id: string;
  merchant_name: string;
  image_url: string | null;
  headline: string | null;
  sub_text: string | null;
  link_url: string | null;
};

const ROTATE_MS = 10000;

const GRADIENTS = [
  'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
  'linear-gradient(135deg, #059669 0%, #0d9488 100%)',
  'linear-gradient(135deg, #e11d48 0%, #db2777 100%)',
  'linear-gradient(135deg, #d97706 0%, #ea580c 100%)',
  'linear-gradient(135deg, #2563eb 0%, #0891b2 100%)',
];

const PromoBanners = () => {
  const navigate = useNavigate();
  const [banners, setBanners]   = useState<AdBanner[]>([]);
  const [current, setCurrent]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [imgError, setImgError] = useState(false);
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

  const startTimer = (len: number) => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCurrent(c => (c + 1) % len);
      setImgError(false);
    }, ROTATE_MS);
  };

  useEffect(() => {
    if (banners.length <= 1) return;
    startTimer(banners.length);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [banners.length]);

  const go = (dir: 1 | -1) => {
    setCurrent(c => (c + dir + banners.length) % banners.length);
    setImgError(false);
    startTimer(banners.length);
  };

  const goTo = (i: number) => {
    setCurrent(i);
    setImgError(false);
    startTimer(banners.length);
  };

  if (loading || banners.length === 0) return null;

  const b = banners[current];
  const gradient = GRADIENTS[current % GRADIENTS.length];
  const hasImage = !!b.image_url && !imgError;

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden mb-5 select-none ${b.link_url ? 'cursor-pointer' : ''}`}
      style={{ height: 240 }}
      onClick={async () => {
        if (!b.link_url) return;
        if (b.link_url.startsWith('http')) { window.open(b.link_url, '_blank', 'noreferrer'); return; }
        const path = b.link_url.replace(/^\//, '').split('?')[0];
        const match = path.match(/^(listing|service)\/([^/]+)$/);
        if (match) {
          const businessId = match[2];
          const { data: biz } = await supabase.from('businesses').select('user_id').eq('id', businessId).single();
          if (biz) {
            const { data: prof } = await supabase.from('profiles').select('business_type').eq('user_id', biz.user_id).single();
            navigate(prof?.business_type === 'service' ? `/service/${businessId}` : `/listing/${businessId}`);
          }
          return;
        }
        navigate(b.link_url);
      }}
    >

      {/* Background */}
      {hasImage ? (
        <img
          key={b.id}
          src={b.image_url!}
          alt={b.merchant_name}
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
          onError={() => setImgError(true)}
        />
      ) : (
        <div
          className="absolute inset-0 transition-all duration-500"
          style={{ background: gradient }}
        />
      )}

      {/* Bottom gradient for text legibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* Top-left merchant badge */}
      <div className="absolute top-3 left-4 z-[5]">
        <span className="text-[11px] font-semibold bg-black/40 backdrop-blur-sm text-white px-2.5 py-1 rounded-full border border-white/20">
          {b.merchant_name}
        </span>
      </div>

      {/* Top-right Sponsored */}
      <div className="absolute top-3 right-4 z-[5]">
        <span className="text-[9px] text-white/50 font-medium">Sponsored</span>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-0 left-0 right-0 px-5 pb-10 z-[5] pointer-events-none">
        {b.headline && (
          <h3 className="text-white font-bold text-xl leading-tight drop-shadow-md line-clamp-2">
            {b.headline}
          </h3>
        )}
        {b.sub_text && (
          <p className="text-white/80 text-sm mt-1 leading-snug line-clamp-1 drop-shadow">
            {b.sub_text}
          </p>
        )}
      </div>

      {/* Prev arrow */}
      {banners.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); go(-1); }}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full p-1.5 transition-colors z-10"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Next arrow */}
      {banners.length > 1 && (
        <button
          onClick={e => { e.stopPropagation(); go(1); }}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 backdrop-blur-sm text-white rounded-full p-1.5 transition-colors z-10"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Dot indicators */}
      {banners.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); goTo(i); }}
              className={`rounded-full transition-all duration-300 ${
                i === current
                  ? 'w-5 h-2 bg-white'
                  : 'w-2 h-2 bg-white/40 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress bar */}
      {banners.length > 1 && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10">
          <div
            key={`${current}-bar`}
            className="h-full bg-white/60"
            style={{ animation: `heroBannerGrow ${ROTATE_MS}ms linear forwards` }}
          />
        </div>
      )}

      <style>{`
        @keyframes heroBannerGrow { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
};

export default PromoBanners;
