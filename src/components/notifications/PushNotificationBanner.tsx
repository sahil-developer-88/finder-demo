import React, { useEffect, useState } from 'react';
import { X, Bell } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PushBannerPayload {
  title: string;
  body: string;
  url?: string;
}

let _show: ((payload: PushBannerPayload) => void) | null = null;

export const showPushBanner = (payload: PushBannerPayload) => {
  if (_show) _show(payload);
};

const AUTO_DISMISS_MS = 6000;

const PushNotificationBanner = () => {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<PushBannerPayload | null>(null);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    _show = (p: PushBannerPayload) => {
      setPayload(p);
      setVisible(true);
      if (timer) clearTimeout(timer);
      const t = setTimeout(() => setVisible(false), AUTO_DISMISS_MS);
      setTimer(t);
    };
    return () => { _show = null; };
  }, []);

  const dismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    setVisible(false);
    if (timer) clearTimeout(timer);
  };

  const handleClick = () => {
    setVisible(false);
    if (timer) clearTimeout(timer);
    if (payload?.url) {
      navigate(payload.url);
    } else {
      navigate('/account-dashboard?tab=inbox');
    }
  };

  if (!visible || !payload) return null;

  return (
    <div
      className="fixed top-20 left-1/2 -translate-x-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm animate-in slide-in-from-top-4 duration-300"
      onClick={handleClick}
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-2xl px-4 py-3.5 flex items-start gap-3 cursor-pointer border border-white/10">
        <div className="shrink-0 w-9 h-9 rounded-xl bg-indigo-500/20 flex items-center justify-center mt-0.5">
          <Bell className="h-4 w-4 text-indigo-400" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{payload.title}</p>
          {payload.body && (
            <p className="text-xs text-white/60 mt-0.5 line-clamp-2">{payload.body}</p>
          )}
          <p className="text-[10px] text-indigo-400 mt-1 font-medium">Tap to open →</p>
        </div>

        <button
          onClick={dismiss}
          className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors mt-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mx-2 h-0.5 bg-white/10 rounded-full overflow-hidden mt-1">
        <div
          className="h-full bg-indigo-400 rounded-full"
          style={{ animation: `shrink ${AUTO_DISMISS_MS}ms linear forwards` }}
        />
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to   { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default PushNotificationBanner;
