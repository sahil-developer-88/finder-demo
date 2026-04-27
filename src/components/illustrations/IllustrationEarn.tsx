import React from 'react';

const IllustrationEarn = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>

    {/* Background blob */}
    <ellipse cx="240" cy="170" rx="220" ry="152" fill="#ecfdf5" />

    {/* === Left side: Business / Service Provider === */}
    {/* Shop building */}
    <rect x="38" y="148" width="110" height="90" rx="10" fill="#d1fae5" />
    <rect x="38" y="148" width="110" height="32" rx="10" fill="#10b981" />
    <rect x="38" y="168" width="110" height="12" fill="#10b981" />
    {/* Sign text bar */}
    <rect x="52" y="157" width="82" height="10" rx="5" fill="#6ee7b7" />
    {/* Door */}
    <rect x="75" y="196" width="26" height="42" rx="5" fill="#6ee7b7" />
    {/* Windows */}
    <rect x="47" y="196" width="20" height="18" rx="4" fill="#a7f3d0" />
    <rect x="119" y="196" width="20" height="18" rx="4" fill="#a7f3d0" />

    {/* Person at shop */}
    {/* Body */}
    <rect x="72" y="138" width="42" height="14" rx="7" fill="#10b981" />
    {/* Head */}
    <circle cx="93" cy="126" r="16" fill="#fde68a" />
    {/* Hair */}
    <ellipse cx="93" cy="114" rx="16" ry="7" fill="#92400e" />
    {/* Eyes */}
    <circle cx="88" cy="123" r="2.5" fill="#92400e" />
    <circle cx="98" cy="123" r="2.5" fill="#92400e" />
    {/* Smile */}
    <path d="M88 131 Q93 136 98 131" stroke="#92400e" strokeWidth="2" strokeLinecap="round" fill="none" />

    {/* === Arrow / transfer === */}
    {/* Dashed flow line */}
    <line x1="166" y1="193" x2="310" y2="193" stroke="#6ee7b7" strokeWidth="2.5" strokeDasharray="7 5" />
    {/* Arrowhead right */}
    <path d="M306 185 L318 193 L306 201" fill="#10b981" />

    {/* Service label above arrow */}
    <rect x="192" y="174" width="94" height="14" rx="7" fill="#d1fae5" />
    <rect x="210" y="178" width="58" height="6" rx="3" fill="#6ee7b7" />

    {/* === Right side: Credit coins === */}
    {/* Coin stack back */}
    <ellipse cx="378" cy="213" rx="36" ry="11" fill="#bbf7d0" />
    <rect x="342" y="180" width="72" height="33" rx="0" fill="#bbf7d0" />
    <ellipse cx="378" cy="180" rx="36" ry="11" fill="#34d399" />

    {/* Coin stack middle */}
    <ellipse cx="378" cy="197" rx="36" ry="11" fill="#6ee7b7" />
    <rect x="342" y="163" width="72" height="34" rx="0" fill="#6ee7b7" />
    <ellipse cx="378" cy="163" rx="36" ry="11" fill="#10b981" />

    {/* Top coin */}
    <ellipse cx="378" cy="148" rx="36" ry="11" fill="#34d399" />
    {/* $ symbol */}
    <text x="378" y="152" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">✦</text>

    {/* Floating credit badges */}
    <circle cx="352" cy="108" r="16" fill="#10b981" />
    <text x="352" y="114" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">$</text>

    <circle cx="406" cy="96" r="12" fill="#34d399" />
    <text x="406" y="101" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold" fontFamily="sans-serif">$</text>

    <circle cx="436" cy="124" r="9" fill="#6ee7b7" />
    <text x="436" y="129" textAnchor="middle" fill="#065f46" fontSize="8" fontWeight="bold" fontFamily="sans-serif">$</text>

    {/* Sparkle dots */}
    <circle cx="68" cy="290" r="5" fill="#6ee7b7" opacity="0.6" />
    <circle cx="158" cy="74" r="4" fill="#34d399" opacity="0.5" />
    <circle cx="430" cy="270" r="6" fill="#a7f3d0" opacity="0.7" />
    <circle cx="240" cy="58" r="4" fill="#6ee7b7" opacity="0.45" />
  </svg>
);

export default IllustrationEarn;
