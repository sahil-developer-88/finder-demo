import React from 'react';

const IllustrationSpend = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>

    {/* Background blob */}
    <ellipse cx="240" cy="170" rx="220" ry="152" fill="#f5f3ff" />

    {/* === Left side: Wallet with credits === */}
    {/* Wallet body */}
    <rect x="44" y="130" width="110" height="78" rx="12" fill="#ede9fe" />
    <rect x="44" y="130" width="110" height="78" rx="12" stroke="#8b5cf6" strokeWidth="2" />
    {/* Wallet flap */}
    <rect x="44" y="130" width="110" height="28" rx="12" fill="#7c3aed" />
    <rect x="44" y="148" width="110" height="10" fill="#7c3aed" />
    {/* Coin pocket */}
    <rect x="114" y="155" width="32" height="40" rx="16" fill="#c4b5fd" />
    <circle cx="130" cy="175" r="12" fill="#8b5cf6" />
    <text x="130" y="180" textAnchor="middle" fill="white" fontSize="11" fontWeight="bold" fontFamily="sans-serif">$</text>

    {/* Credit cards inside wallet */}
    <rect x="56" y="157" width="50" height="30" rx="6" fill="#a78bfa" />
    <rect x="56" y="157" width="50" height="10" rx="6" fill="#7c3aed" />
    <rect x="60" y="174" width="22" height="5" rx="2.5" fill="#c4b5fd" />

    {/* Credit balance label */}
    <rect x="52" y="218" width="94" height="22" rx="11" fill="#7c3aed" />
    <rect x="68" y="224" width="62" height="10" rx="5" fill="#a78bfa" />

    {/* === Center: Exchange arrows === */}
    {/* Right arrow */}
    <path d="M174 175 L240 175" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="6 4" />
    <path d="M236 167 L248 175 L236 183" fill="#7c3aed" />

    {/* Circular swap icon */}
    <circle cx="240" cy="175" r="22" fill="#ede9fe" stroke="#8b5cf6" strokeWidth="2" />
    <path d="M232 168 Q240 160 248 168" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M248 182 Q240 190 232 182" stroke="#7c3aed" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    <path d="M248 165 L248 171" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />
    <path d="M232 179 L232 185" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" />

    {/* Left arrow from center */}
    <path d="M262 175 L326 175" stroke="#8b5cf6" strokeWidth="2.5" strokeDasharray="6 4" />
    <path d="M322 167 L334 175 L322 183" fill="#7c3aed" />

    {/* === Right side: Storefront / products === */}
    {/* Store building */}
    <rect x="336" y="138" width="106" height="96" rx="10" fill="#ddd6fe" />
    {/* Awning */}
    <rect x="336" y="138" width="106" height="30" rx="10" fill="#7c3aed" />
    <rect x="336" y="156" width="106" height="12" fill="#7c3aed" />
    {/* Awning stripes */}
    <line x1="356" y1="138" x2="356" y2="168" stroke="#6d28d9" strokeWidth="2" />
    <line x1="378" y1="138" x2="378" y2="168" stroke="#6d28d9" strokeWidth="2" />
    <line x1="400" y1="138" x2="400" y2="168" stroke="#6d28d9" strokeWidth="2" />
    <line x1="422" y1="138" x2="422" y2="168" stroke="#6d28d9" strokeWidth="2" />

    {/* Sign */}
    <rect x="354" y="145" width="70" height="12" rx="6" fill="#c4b5fd" />

    {/* Door */}
    <rect x="373" y="192" width="28" height="42" rx="5" fill="#a78bfa" />
    {/* Windows */}
    <rect x="344" y="178" width="22" height="18" rx="4" fill="#c4b5fd" />
    <rect x="412" y="178" width="22" height="18" rx="4" fill="#c4b5fd" />

    {/* Product boxes on shelf */}
    <rect x="344" y="154" width="14" height="14" rx="3" fill="#a78bfa" />
    <rect x="362" y="154" width="14" height="14" rx="3" fill="#8b5cf6" />
    <rect x="380" y="154" width="14" height="14" rx="3" fill="#a78bfa" />

    {/* "Open" badge */}
    <circle cx="438" cy="145" r="16" fill="#10b981" />
    <rect x="430" y="140" width="16" height="10" rx="5" fill="white" opacity="0.9" />

    {/* Sparkle dots */}
    <circle cx="72" cy="290" r="5" fill="#c4b5fd" opacity="0.6" />
    <circle cx="416" cy="282" r="6" fill="#a78bfa" opacity="0.5" />
    <circle cx="170" cy="72" r="4" fill="#8b5cf6" opacity="0.45" />
    <circle cx="304" cy="68" r="5" fill="#c4b5fd" opacity="0.55" />
  </svg>
);

export default IllustrationSpend;
