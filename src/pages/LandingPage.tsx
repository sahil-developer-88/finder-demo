import React, { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Zap, ArrowRight, CheckCircle,
  DollarSign, Package, Users, TrendingUp, Clock, Network, Star,
} from 'lucide-react';
import IllustrationJoin from '@/components/illustrations/IllustrationJoin';
import IllustrationEarn from '@/components/illustrations/IllustrationEarn';
import IllustrationSpend from '@/components/illustrations/IllustrationSpend';
import IllustrationGrow from '@/components/illustrations/IllustrationGrow';

/* ─────────────── data ─────────────── */

const BENEFITS = [
  { icon: DollarSign, title: 'Preserve Cash',            body: 'Cover real expenses with barter credits and keep more cash for payroll, rent, and growth.',          accent: '#10b981' },
  { icon: Package,    title: 'Move Excess Inventory',    body: 'Turn slow-moving stock, empty slots, and unused time into purchasing power across the network.',      accent: '#6366f1' },
  { icon: Users,      title: 'Gain New Customers',       body: 'Barter introduces your business to members who can become loyal, cash-paying customers.',             accent: '#8b5cf6' },
  { icon: TrendingUp, title: 'Increase Sales',           body: 'Every trade generates revenue from capacity that would otherwise be completely wasted.',              accent: '#3b82f6' },
  { icon: Clock,      title: 'Use Idle Capacity',        body: 'Empty chairs, unused hours, open rooms — all have real value inside the network.',                   accent: '#f59e0b' },
  { icon: Network,    title: 'Build Connections',        body: 'Open doors to strategic partnerships, referrals, and business relationships you never expected.',     accent: '#ec4899' },
];

const TRADE_EXAMPLES = [
  'Restaurants', 'Contractors', 'Medical & Wellness', 'Marketing & Advertising',
  'Professional Services', 'Retail Products', 'Salons & Spas', 'Printing & Signage',
  'Hospitality & Travel', 'Events & Entertainment', 'Automotive Services',
  'Home Services', 'Business Consulting', 'Fitness & Training', 'Technology & Creative',
];

const VS_ROWS = [
  { old: 'One-to-one match required',    next: 'Trade with any network member' },
  { old: 'Limited flexibility',          next: 'Earn from one, spend elsewhere' },
  { old: 'Hard to scale',                next: 'Network grows your options' },
  { old: 'Waiting for the right match',  next: 'Credits available any time' },
];

const STEPS = [
  { num: '01', title: 'Join the network',         body: 'Create your business profile and list the products or services you want to offer.',                                                              Illustration: IllustrationJoin  },
  { num: '02', title: 'Earn barter credits',      body: 'When another member buys from you, you earn barter credits — no cash needed.',                                                                  Illustration: IllustrationEarn  },
  { num: '03', title: 'Spend across the network', body: 'Use your credits at any participating business — services, products, dining, repairs, marketing, and more.',                                    Illustration: IllustrationSpend },
  { num: '04', title: 'Grow with every trade',    body: 'Convert idle capacity into real buying power and expand your reach inside a growing community.',                                                 Illustration: IllustrationGrow  },
];

const STRATEGIC = [
  'Maximize underused resources',
  'Increase transactional volume',
  'Unlock new purchasing power',
  'Create leads and referrals',
  'Keep more cash in your business',
  'Think beyond traditional payments',
];

/* ─────────────── page ─────────────── */

const LandingPage = () => {
  const navigate = useNavigate();

  // Staggered animation for VS rows — plays once per session
  const vsRef = useRef<HTMLDivElement>(null);
  const [vsVisible, setVsVisible] = useState(() => sessionStorage.getItem('vs-animated') === '1');
  useEffect(() => {
    if (vsVisible) return; // already played
    const el = vsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVsVisible(true);
          sessionStorage.setItem('vs-animated', '1');
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [vsVisible]);

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ══════════ HERO ══════════ */}
      <section className="relative overflow-hidden bg-white pt-16 pb-24 sm:pt-20 sm:pb-32">

        {/* ── Stripe-style animated wave ribbon ── */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* SVG wave canvas */}
          <svg
            className="absolute top-0 right-0 w-full h-full"
            viewBox="0 0 1200 700"
            preserveAspectRatio="xMidYMid slice"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ribbon1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.9" />
                <stop offset="35%"  stopColor="#f472b6" stopOpacity="0.9" />
                <stop offset="65%"  stopColor="#fb923c" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#f472b6" stopOpacity="0.7" />
              </linearGradient>
              <linearGradient id="ribbon2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.7" />
                <stop offset="40%"  stopColor="#ec4899" stopOpacity="0.8" />
                <stop offset="80%"  stopColor="#f97316" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="ribbon3" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor="#c084fc" stopOpacity="0.5" />
                <stop offset="50%"  stopColor="#fb7185" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#fdba74" stopOpacity="0.4" />
              </linearGradient>
              <filter id="wave-blur">
                <feGaussianBlur stdDeviation="2" />
              </filter>
            </defs>

            {/* Ribbon band 1 — main large sweep */}
            <g className="wave-ribbon-1" style={{ transformOrigin: '600px 350px' }}>
              <path
                d="M-50,420 C150,180 350,500 600,200 C800,20 1000,350 1300,150 L1300,320 C1000,520 800,190 600,370 C350,670 150,350 -50,590 Z"
                fill="url(#ribbon1)"
                filter="url(#wave-blur)"
              />
            </g>

            {/* Ribbon band 2 — secondary thinner ribbon */}
            <g className="wave-ribbon-2" style={{ transformOrigin: '600px 300px' }}>
              <path
                d="M-50,300 C200,80 400,400 650,150 C850,-30 1050,280 1300,80 L1300,200 C1050,400 850,90 650,270 C400,520 200,200 -50,420 Z"
                fill="url(#ribbon2)"
                filter="url(#wave-blur)"
                opacity="0.75"
              />
            </g>

            {/* Ribbon band 3 — subtle highlight layer */}
            <g className="wave-ribbon-3" style={{ transformOrigin: '600px 250px' }}>
              <path
                d="M100,380 C280,200 480,440 680,220 C840,60 1020,300 1200,120 L1200,190 C1020,370 840,130 680,290 C480,510 280,270 100,450 Z"
                fill="url(#ribbon3)"
                filter="url(#wave-blur)"
                opacity="0.6"
              />
            </g>
          </svg>

          {/* Solid white cover on text side, fade to transparent on right so wave shows */}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(255,255,255,1) 40%, rgba(255,255,255,0.6) 60%, rgba(255,255,255,0.05) 100%)' }}
          />
          {/* Bottom fade */}
          <div
            className="absolute bottom-0 left-0 right-0 h-32"
            style={{ background: 'linear-gradient(to top, white, transparent)' }}
          />
        </div>

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            {/* Left: text */}
            <div className="max-w-xl">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-1.5 mb-7">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Barter Marketplace</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 leading-[1.08] tracking-tight mb-6">
                Turn what you have into{' '}
                <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-500 bg-clip-text text-transparent">
                  what you need.
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-slate-500 leading-relaxed mb-8">
                A modern barter network where businesses trade products, services, and excess capacity using digital credits — preserving cash and growing together.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link
                  to="/auth"
                  className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl text-white font-bold text-base transition-all hover:opacity-90 hover:scale-[1.02] shadow-xl"
                  style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                >
                  <Zap className="h-4 w-4" fill="currentColor" />
                  Start for free
                </Link>
              </div>

              {/* Trust row */}
              <div className="flex items-center gap-6 flex-wrap">
                {[
                  { val: '100%',  label: 'Free to join' },
                ].map((s, i) => (
                  <div key={s.label} className="flex items-center gap-2">
                    {i > 0 && <span className="w-px h-8 bg-slate-300" />}
                    <div className="flex flex-col">
                      <span className="text-2xl font-black text-slate-900 leading-none">{s.val}</span>
                      <span className="text-xs font-semibold text-slate-600 mt-0.5">{s.label}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: floating card stack */}
            <div className="hidden lg:flex items-center justify-center relative">
              <div className="relative w-full max-w-sm">
                {/* Back card */}
                <div className="absolute top-6 left-6 right-0 bg-white rounded-3xl shadow-xl border border-slate-100 h-64 -z-0" />
                {/* Main card */}
                <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 z-10">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                      <Zap className="h-5 w-5 text-white" fill="white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">Value Exchange Network</p>
                      <p className="text-xs text-slate-400">Barter credits earned</p>
                    </div>
                  </div>
                  <div className="text-4xl font-black text-slate-900 mb-1">+$1,240</div>
                  <p className="text-sm text-emerald-600 font-semibold mb-5">↑ 24% this month</p>
                  <div className="space-y-2.5">
                    {[
                      { biz: 'Bella\'s Catering',    val: '+$320', color: 'bg-emerald-500' },
                      { biz: 'Peak Fitness Studio',  val: '+$180', color: 'bg-indigo-500'  },
                      { biz: 'Metro Print Co.',      val: '+$490', color: 'bg-violet-500'  },
                    ].map(row => (
                      <div key={row.biz} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${row.color} flex-shrink-0`} />
                          <span className="text-sm font-medium text-slate-700">{row.biz}</span>
                        </div>
                        <span className="text-sm font-bold text-emerald-600">{row.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-lg border border-slate-100 px-4 py-2.5 flex items-center gap-2 z-20">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  <span className="text-xs font-bold text-slate-700">Live trades happening now</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ LOGO/TRUST BAR ══════════ */}
      <section className="py-10 bg-slate-50 border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-xs font-bold text-slate-600 uppercase tracking-widest mb-6">Businesses in the network trade across</p>
          <div className="flex flex-wrap justify-center gap-3">
            {TRADE_EXAMPLES.slice(0, 8).map(t => (
              <span key={t} className="text-sm font-bold text-slate-800 bg-white border border-slate-300 rounded-full px-4 py-1.5 shadow-sm">{t}</span>
            ))}
            <span className="text-sm font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-full px-4 py-1.5 shadow-sm">+7 more</span>
          </div>
        </div>
      </section>

      {/* ══════════ WHAT IS BARTER ══════════ */}
      <section className="py-24 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">What Is Barter?</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-4">
              Barter, reimagined for{' '}
              <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
                modern business.
              </span>
            </h2>
            <p className="text-slate-500 leading-relaxed">
              Earn credits when you provide goods or services, then spend them with any other business. No direct match needed.
            </p>
          </div>

          {/* 3-column: left cards | person | right cards */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px_1fr] gap-6 items-center">

            {/* ── Left column: cards 1 & 2 ── */}
            <div className="flex flex-col gap-5">

              {/* Card 1 */}
              <div className="bubble-1 group relative bg-white border-2 border-indigo-100 rounded-2xl p-6 shadow-md hover:shadow-xl hover:border-indigo-300 transition-all duration-300">
                {/* Arrow pointing right toward person */}
                <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-l-[16px] border-t-transparent border-b-transparent border-l-indigo-100 group-hover:border-l-indigo-300 transition-colors z-10" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-500/30">
                    <span className="text-white font-black text-sm">1</span>
                  </div>
                  <p className="font-black text-slate-900 text-base">List your services</p>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">Set what your business offers and define your barter percentage rate for the network.</p>
              </div>

              {/* Card 2 */}
              <div className="bubble-2 group relative bg-white border-2 border-violet-100 rounded-2xl p-6 shadow-md hover:shadow-xl hover:border-violet-300 transition-all duration-300">
                <div className="hidden lg:block absolute -right-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-l-[16px] border-t-transparent border-b-transparent border-l-violet-100 group-hover:border-l-violet-300 transition-colors z-10" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-violet-500/30">
                    <span className="text-white font-black text-sm">2</span>
                  </div>
                  <p className="font-black text-slate-900 text-base">A member buys from you</p>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">When someone purchases your service, barter credits are instantly deposited into your account.</p>
              </div>
            </div>

            {/* ── Center: tall person image ── */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[320px]">
                {/* Glow effect behind image */}
                <div className="absolute -inset-3 bg-gradient-to-b from-indigo-200 via-violet-200 to-indigo-200 rounded-3xl blur-xl opacity-50" />
                {/* Image */}
                <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-white" style={{ height: '420px' }}>
                  <img
                    src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=560&fit=crop&crop=top&q=85"
                    alt="Business advisor"
                    className="w-full h-full object-cover object-top"
                  />
                  {/* Bottom gradient */}
                  <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-slate-900/60 to-transparent" />
                </div>
              </div>
            </div>

            {/* ── Right column: cards 3 & 4 ── */}
            <div className="flex flex-col gap-5">

              {/* Card 3 */}
              <div className="bubble-3 group relative bg-white border-2 border-emerald-100 rounded-2xl p-6 shadow-md hover:shadow-xl hover:border-emerald-300 transition-all duration-300">
                {/* Arrow pointing left toward person */}
                <div className="hidden lg:block absolute -left-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-r-[16px] border-t-transparent border-b-transparent border-r-emerald-100 group-hover:border-r-emerald-300 transition-colors z-10" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-500/30">
                    <span className="text-white font-black text-sm">3</span>
                  </div>
                  <p className="font-black text-slate-900 text-base">Spend at other shops</p>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">Use your barter credits like cash at any participating business across the entire network.</p>
              </div>

              {/* Card 4 */}
              <div className="bubble-4 group relative bg-white border-2 border-blue-100 rounded-2xl p-6 shadow-md hover:shadow-xl hover:border-blue-300 transition-all duration-300">
                <div className="hidden lg:block absolute -left-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[10px] border-b-[10px] border-r-[16px] border-t-transparent border-b-transparent border-r-blue-100 group-hover:border-r-blue-300 transition-colors z-10" />
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-blue-500/30">
                    <span className="text-white font-black text-sm">4</span>
                  </div>
                  <p className="font-black text-slate-900 text-base">Your business grows</p>
                </div>
                <p className="text-sm text-slate-600 font-medium leading-relaxed">More reach, more customers, and more value with every trade inside the growing network.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ BENEFITS ══════════ */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-xl mx-auto mb-14">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Benefits</p>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
              Why businesses join<br />a barter network.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

            {/* Card 1 — Emerald */}
            <div className="benefit-float-1">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-emerald-200/60 hover:shadow-2xl hover:shadow-emerald-300/70"
                style={{ background: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 50%, #6ee7b7 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <DollarSign className="h-6 w-6 text-emerald-700" />
                  </div>
                  <h3 className="font-black text-emerald-900 text-lg mb-2">Preserve Cash</h3>
                  <p className="text-sm text-emerald-800/80 font-medium leading-relaxed">Use barter credits for real expenses and keep more cash for payroll, rent, and growth.</p>
                </div>
              </div>
            </div>

            {/* Card 2 — Indigo */}
            <div className="benefit-float-2">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-indigo-200/60 hover:shadow-2xl hover:shadow-indigo-300/70"
                style={{ background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <Package className="h-6 w-6 text-indigo-700" />
                  </div>
                  <h3 className="font-black text-indigo-900 text-lg mb-2">Move Excess Inventory</h3>
                  <p className="text-sm text-indigo-800/80 font-medium leading-relaxed">Turn slow stock, open slots, and unused time into real purchasing power across the network.</p>
                </div>
              </div>
            </div>

            {/* Card 3 — Violet */}
            <div className="benefit-float-3">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-violet-200/60 hover:shadow-2xl hover:shadow-violet-300/70"
                style={{ background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 50%, #c4b5fd 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <Users className="h-6 w-6 text-violet-700" />
                  </div>
                  <h3 className="font-black text-violet-900 text-lg mb-2">Gain New Customers</h3>
                  <p className="text-sm text-violet-800/80 font-medium leading-relaxed">Barter introduces you to a network of members who can become loyal cash-paying customers.</p>
                </div>
              </div>
            </div>

            {/* Card 4 — Blue */}
            <div className="benefit-float-4">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-blue-200/60 hover:shadow-2xl hover:shadow-blue-300/70"
                style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <TrendingUp className="h-6 w-6 text-blue-700" />
                  </div>
                  <h3 className="font-black text-blue-900 text-lg mb-2">Increase Sales</h3>
                  <p className="text-sm text-blue-800/80 font-medium leading-relaxed">Every trade generates revenue from capacity that would otherwise go completely to waste.</p>
                </div>
              </div>
            </div>

            {/* Card 5 — Amber */}
            <div className="benefit-float-5">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-amber-200/60 hover:shadow-2xl hover:shadow-amber-300/70"
                style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <Clock className="h-6 w-6 text-amber-700" />
                  </div>
                  <h3 className="font-black text-amber-900 text-lg mb-2">Use Idle Capacity</h3>
                  <p className="text-sm text-amber-800/80 font-medium leading-relaxed">Empty chairs, unused hours, open rooms — all have real value inside the network.</p>
                </div>
              </div>
            </div>

            {/* Card 6 — Pink */}
            <div className="benefit-float-6">
              <div className="benefit-inner relative rounded-3xl p-7 overflow-hidden shadow-xl shadow-pink-200/60 hover:shadow-2xl hover:shadow-pink-300/70"
                style={{ background: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)' }}>
                <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/20" />
                <div className="absolute -bottom-8 -left-4 w-36 h-36 rounded-full bg-white/10" />
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-white/40 backdrop-blur-sm flex items-center justify-center mb-5 shadow-sm">
                    <Network className="h-6 w-6 text-pink-700" />
                  </div>
                  <h3 className="font-black text-pink-900 text-lg mb-2">Build Connections</h3>
                  <p className="text-sm text-pink-800/80 font-medium leading-relaxed">Open doors to strategic partnerships, referrals, and relationships you never expected.</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="bg-white">
        {/* Header */}
        <div className="pt-24 pb-12 text-center max-w-2xl mx-auto px-4">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">How It Works</p>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight">
            Four simple steps to{' '}
            <span className="bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
              trade smarter.
            </span>
          </h2>
        </div>

        {/* Step rows — full bleed alternating */}
        {[
          {
            num: '01', lightBg: '#eef2ff', borderColor: '#c7d2fe',
            title: 'Join the network',
            body: 'Create your business profile and list what you want to offer. Set your barter percentage and become visible to every member in the network.',
            img: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&h=560&fit=crop&q=85',
            imgAlt: 'Small business owner at their restaurant',
          },
          {
            num: '02', lightBg: '#ecfdf5', borderColor: '#a7f3d0',
            title: 'Earn barter credits',
            body: 'When another member purchases from you, barter credits land instantly in your account — no invoicing, no chasing payment, no cash needed.',
            img: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?w=800&h=560&fit=crop&q=85',
            imgAlt: 'Barista providing a service and earning credits',
            flip: true,
          },
          {
            num: '03', lightBg: '#f5f3ff', borderColor: '#ddd6fe',
            title: 'Spend across the network',
            body: 'Use your credits like cash at any participating business — services, products, dining, repairs, marketing, and more. No direct match required.',
            img: 'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&h=560&fit=crop&q=85',
            imgAlt: 'Customer spending credits at a local service',
          },
          {
            num: '04', lightBg: '#eff6ff', borderColor: '#bfdbfe',
            title: 'Grow with every trade',
            body: 'Convert idle capacity into real buying power. Gain new customers, build partnerships, and keep compounding value with every cycle.',
            img: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&h=560&fit=crop&q=85',
            imgAlt: 'Thriving business owner growing through the network',
            flip: true,
          },
        ].map((step) => (
          <div key={step.num} className="border-t border-slate-100">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
              <div className={`grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center ${step.flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>

                {/* Text side */}
                <div>
                  <span
                    className="block text-[96px] font-black leading-none mb-2 select-none"
                    style={{ color: step.lightBg, WebkitTextStroke: `2px ${step.borderColor}` }}
                  >
                    {step.num}
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 mb-4 leading-tight">{step.title}</h3>
                  <p className="text-slate-500 text-base sm:text-lg leading-relaxed">{step.body}</p>
                </div>

                {/* Image side */}
                <div className="flex justify-center">
                  <div className="w-full max-w-md rounded-3xl overflow-hidden shadow-xl border-2" style={{ borderColor: step.borderColor }}>
                    <img
                      src={step.img}
                      alt={step.imgAlt}
                      className="w-full h-64 sm:h-72 object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* CTA row */}
        <div className="border-t border-slate-100 py-14 text-center">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-white font-bold text-base hover:opacity-90 transition-all hover:scale-[1.02] shadow-lg"
            style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
          >
            <Zap className="h-4 w-4" fill="currentColor" />
            Start trading free
          </Link>
        </div>
      </section>

      {/* ══════════ OPPORTUNITY — full-bleed image ══════════ */}
      <section className="relative overflow-hidden">
        {/* Background image — busy restaurant/business */}
        <img
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1600&h=900&fit=crop&q=85"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(15,23,42,0.52) 0%, rgba(30,27,75,0.45) 100%)' }} />
        {/* Indigo glow */}
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: '#6366f1' }} />

        <div className="relative py-24 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">

            {/* Left: headline + body */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">The Opportunity</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-6">
                Your Business Has More Value Than You Think
              </h2>
              <div className="space-y-4 text-slate-300 text-base leading-relaxed mb-8">
                <p>Most businesses have hidden value sitting on the table every single day.</p>
                <p>
                  Empty appointments. Unused staff time. Unsold inventory. Last-minute openings. Extra capacity.{' '}
                  Instead of letting those opportunities go to waste, barter lets you transform them into purchasing power.
                </p>
                <p className="text-white font-semibold">
                  That's the power of a well-built barter system.
                </p>
              </div>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-bold text-base text-white hover:opacity-90 transition-all hover:scale-[1.02] shadow-xl"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <Zap className="h-4 w-4" fill="currentColor" />
                Unlock your hidden value
              </Link>
            </div>

            {/* Right: "What if" cards */}
            <div className="flex flex-col gap-4">
              {[
                { icon: '⏰', q: 'What if your slow hours could pay for marketing?' },
                { icon: '📦', q: 'What if your excess inventory could cover office cleaning, printing, meals, or repairs?' },
                { icon: '🤝', q: 'What if barter could introduce you to a whole network of businesses ready to buy from you?' },
              ].map(card => (
                <div key={card.q} className="flex items-start gap-4 rounded-2xl p-5 border border-white/10" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(8px)' }}>
                  <span className="text-2xl flex-shrink-0 mt-0.5">{card.icon}</span>
                  <p className="text-white font-semibold text-base leading-snug">{card.q}</p>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ NOT OLD-SCHOOL ══════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-4">Modern Barter</p>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 leading-tight mb-6">
                This isn't old-school barter.
              </h2>
              <div className="space-y-4 text-slate-500 leading-relaxed">
                <p>Traditional barter is slow — it requires finding the exact person who has what you want <em>and</em> wants exactly what you have.</p>
                <p>A credit-based network changes everything. Earn from one member, spend with another. Flexibility, speed, and scale.</p>
                <p className="font-bold text-slate-800">Barter built for the way modern business actually works.</p>
              </div>
            </div>

            <div
              ref={vsRef}
              className="rounded-3xl p-8 space-y-3"
              style={{ background: 'linear-gradient(135deg, #f8faff 0%, #f3f0ff 100%)', border: '1px solid #e0e7ff' }}
            >
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-5">Old way vs. Value Exchange</p>
              {VS_ROWS.map((row, i) => (
                <div
                  key={row.old}
                  className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100"
                  style={{
                    opacity: vsVisible ? 1 : 0,
                    transform: vsVisible ? 'translateY(0)' : 'translateY(24px)',
                    transition: `opacity 0.5s ease, transform 0.5s ease`,
                    transitionDelay: vsVisible ? `${i * 150}ms` : '0ms',
                  }}
                >
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-50">
                    <span className="w-5 h-5 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 text-red-400 text-xs font-bold">✕</span>
                    <span className="text-sm text-slate-400 line-through">{row.old}</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm font-semibold text-slate-800">{row.next}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ STRATEGIC OWNERS ══════════ */}
      <section className="py-24 relative overflow-hidden bg-slate-900">

        {/* Rising particles */}
        {[
          { left: '5%',  size: 6,  delay: 0,    dur: 7,  color: '#818cf8' },
          { left: '12%', size: 4,  delay: 1.5,  dur: 9,  color: '#10b981' },
          { left: '20%', size: 8,  delay: 0.5,  dur: 8,  color: '#a78bfa' },
          { left: '30%', size: 5,  delay: 3,    dur: 6,  color: '#34d399' },
          { left: '42%', size: 7,  delay: 1,    dur: 10, color: '#6366f1' },
          { left: '53%', size: 4,  delay: 2.5,  dur: 7,  color: '#818cf8' },
          { left: '63%', size: 9,  delay: 0.8,  dur: 9,  color: '#10b981' },
          { left: '72%', size: 5,  delay: 3.5,  dur: 8,  color: '#c084fc' },
          { left: '80%', size: 6,  delay: 1.2,  dur: 6,  color: '#34d399' },
          { left: '88%', size: 4,  delay: 4,    dur: 11, color: '#6366f1' },
          { left: '94%', size: 7,  delay: 2,    dur: 8,  color: '#a78bfa' },
          { left: '38%', size: 5,  delay: 5,    dur: 7,  color: '#818cf8' },
        ].map((p, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: p.left,
              bottom: '-20px',
              width: p.size,
              height: p.size,
              background: p.color,
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
              opacity: 0,
            }}
          />
        ))}

        <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-start">

            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 mb-4">For Strategic Thinkers</p>
              <h2 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-6">
                Built for owners who think strategically.
              </h2>
              <p className="text-slate-300 leading-relaxed mb-8">
                Whether you want to lower expenses, fill downtime, move inventory, or create new opportunities — barter can become a serious business advantage.
              </p>
              <Link
                to="/auth"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white font-bold text-sm hover:opacity-90 transition-all hover:scale-[1.02] shadow-lg"
                style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
              >
                <Zap className="h-4 w-4" fill="currentColor" />
                Join the network
              </Link>
            </div>

            <div className="space-y-2.5">
              {STRATEGIC.map((b, i) => (
                <div
                  key={b}
                  className="flex items-center gap-4 rounded-xl border border-white/10 px-5 py-4 hover:border-indigo-400/40 hover:bg-white/5 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(6px)' }}
                >
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-black shadow-sm"
                    style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}
                  >
                    {i + 1}
                  </div>
                  <span className="text-slate-200 font-medium text-sm">{b}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* ══════════ QUOTE / COMMUNITY ══════════ */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center gap-1 mb-6">
            {[...Array(5)].map((_, i) => <Star key={i} className="h-5 w-5 text-amber-400 fill-amber-400" />)}
          </div>
          <blockquote className="text-2xl sm:text-3xl md:text-4xl font-black text-slate-900 leading-snug mb-5">
            "Barter creates relationships, trust, and{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
              real growth
            </span>
            {' '}— not just transactions."
          </blockquote>
          <p className="text-slate-400 font-medium">When businesses help each other, everyone wins.</p>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="py-24 relative overflow-hidden bg-white">
        {/* Reuse wave ribbon at bottom */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 1200 500" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
              <linearGradient id="ctaRibbon1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#818cf8" stopOpacity="0.7" />
                <stop offset="40%"  stopColor="#f472b6" stopOpacity="0.7" />
                <stop offset="80%"  stopColor="#fb923c" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#818cf8" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="ctaRibbon2" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%"   stopColor="#c084fc" stopOpacity="0.5" />
                <stop offset="50%"  stopColor="#fb7185" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#fdba74" stopOpacity="0.4" />
              </linearGradient>
              <filter id="cta-blur"><feGaussianBlur stdDeviation="2" /></filter>
            </defs>
            <g className="wave-ribbon-2" style={{ transformOrigin: '600px 250px' }}>
              <path d="M-50,300 C200,80 500,380 750,150 C950,-20 1100,260 1300,80 L1300,210 C1100,390 950,110 750,280 C500,510 200,210 -50,430 Z" fill="url(#ctaRibbon1)" filter="url(#cta-blur)" />
            </g>
            <g className="wave-ribbon-3" style={{ transformOrigin: '600px 200px' }}>
              <path d="M0,220 C200,60 450,340 700,130 C880,-20 1050,220 1250,60 L1250,150 C1050,310 880,70 700,220 C450,430 200,150 0,310 Z" fill="url(#ctaRibbon2)" filter="url(#cta-blur)" opacity="0.7" />
            </g>
          </svg>
          <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.93)' }} />
        </div>

        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">Get Started</p>
          <h2 className="text-4xl sm:text-5xl font-black text-slate-900 leading-tight mb-5">
            Start turning barter into opportunity.
          </h2>
          <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-xl mx-auto">
            Your business already has value. Join a growing network and put that value to work.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl text-white font-bold text-base hover:opacity-90 hover:scale-[1.02] transition-all shadow-2xl"
              style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', boxShadow: '0 20px 40px -10px rgba(99,102,241,0.4)' }}
            >
              <Zap className="h-4 w-4" fill="currentColor" />
              Get started — it's free
            </Link>
          </div>

          <p className="text-sm text-slate-400 italic">
            Barter isn't going backward — it's using what you already have to move forward.
          </p>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
