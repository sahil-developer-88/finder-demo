import React from 'react';

const IllustrationJoin = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>

    {/* Background blob */}
    <ellipse cx="240" cy="170" rx="224" ry="158" fill="#eef2ff" />

    {/* Network dotted lines */}
    <line x1="50" y1="62" x2="148" y2="128" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="6 4" />
    <line x1="430" y1="62" x2="336" y2="128" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="6 4" />
    <line x1="50" y1="278" x2="148" y2="214" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="6 4" />
    <line x1="430" y1="278" x2="336" y2="214" stroke="#c7d2fe" strokeWidth="2" strokeDasharray="6 4" />
    <line x1="50" y1="62" x2="50" y2="278" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="5 5" />
    <line x1="430" y1="62" x2="430" y2="278" stroke="#c7d2fe" strokeWidth="1.5" strokeDasharray="5 5" />

    {/* Corner network nodes */}
    <circle cx="50" cy="62" r="15" fill="#e0e7ff" />
    <circle cx="50" cy="62" r="8" fill="#818cf8" />
    <circle cx="430" cy="62" r="15" fill="#e0e7ff" />
    <circle cx="430" cy="62" r="8" fill="#a5b4fc" />
    <circle cx="50" cy="278" r="15" fill="#e0e7ff" />
    <circle cx="50" cy="278" r="8" fill="#6366f1" />
    <circle cx="430" cy="278" r="15" fill="#e0e7ff" />
    <circle cx="430" cy="278" r="8" fill="#818cf8" />

    {/* Laptop screen frame */}
    <rect x="108" y="58" width="214" height="172" rx="14" fill="#1e293b" />
    {/* Screen surface */}
    <rect x="116" y="66" width="198" height="156" rx="9" fill="#f8fafc" />
    {/* Laptop base */}
    <rect x="88" y="228" width="254" height="15" rx="5" fill="#334155" />
    <rect x="76" y="242" width="278" height="9" rx="5" fill="#475569" />

    {/* Screen header */}
    <rect x="116" y="66" width="198" height="38" rx="9" fill="#6366f1" />
    <rect x="116" y="89" width="198" height="15" fill="#6366f1" />
    <circle cx="133" cy="85" r="5" fill="#818cf8" />
    <circle cx="149" cy="85" r="5" fill="#818cf8" />
    <circle cx="165" cy="85" r="5" fill="#818cf8" />
    <rect x="190" y="79" width="86" height="12" rx="6" fill="#a5b4fc" />

    {/* Avatar on screen */}
    <circle cx="215" cy="138" r="26" fill="#e0e7ff" />
    <circle cx="215" cy="130" r="12" fill="#6366f1" />
    <ellipse cx="215" cy="157" rx="17" ry="10" fill="#6366f1" />

    {/* Form fields */}
    <rect x="143" y="172" width="144" height="9" rx="4.5" fill="#e0e7ff" />
    <rect x="143" y="188" width="104" height="9" rx="4.5" fill="#e0e7ff" />

    {/* Join button */}
    <rect x="152" y="205" width="126" height="28" rx="9" fill="#6366f1" />
    <rect x="180" y="215" width="70" height="8" rx="4" fill="white" opacity="0.65" />

    {/* Checkmark badge */}
    <circle cx="287" cy="95" r="19" fill="#10b981" />
    <path d="M279 95L285 102L296 87" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />

    {/* Person figure */}
    {/* Head */}
    <circle cx="388" cy="146" r="30" fill="#fde68a" />
    {/* Hair */}
    <ellipse cx="388" cy="122" rx="30" ry="12" fill="#92400e" />
    {/* Body */}
    <rect x="364" y="179" width="48" height="62" rx="14" fill="#6366f1" />
    {/* Eyes */}
    <circle cx="379" cy="142" r="4" fill="#92400e" />
    <circle cx="397" cy="142" r="4" fill="#92400e" />
    {/* Smile */}
    <path d="M379 156 Q388 165 397 156" stroke="#92400e" strokeWidth="2.5" strokeLinecap="round" fill="none" />
    {/* Pointing arm */}
    <rect x="334" y="180" width="32" height="14" rx="7" fill="#6366f1" />
    <circle cx="330" cy="187" r="11" fill="#fde68a" />

    {/* Floating sparkle dots */}
    <circle cx="90" cy="155" r="5" fill="#a5b4fc" opacity="0.6" />
    <circle cx="410" cy="185" r="4" fill="#818cf8" opacity="0.5" />
    <circle cx="380" cy="290" r="6" fill="#c7d2fe" opacity="0.7" />
  </svg>
);

export default IllustrationJoin;
