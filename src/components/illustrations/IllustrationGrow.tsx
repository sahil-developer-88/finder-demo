import React from 'react';

const IllustrationGrow = ({ className = '' }: { className?: string }) => (
  <svg viewBox="0 0 480 340" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>

    {/* Background blob */}
    <ellipse cx="240" cy="170" rx="220" ry="152" fill="#eff6ff" />

    {/* === Bar chart (bottom left) === */}
    {/* Chart base line */}
    <line x1="54" y1="270" x2="200" y2="270" stroke="#bfdbfe" strokeWidth="2" />
    {/* Bars */}
    <rect x="62" y="240" width="22" height="30" rx="4" fill="#bfdbfe" />
    <rect x="92" y="220" width="22" height="50" rx="4" fill="#93c5fd" />
    <rect x="122" y="195" width="22" height="75" rx="4" fill="#3b82f6" />
    <rect x="152" y="170" width="22" height="100" rx="4" fill="#2563eb" />

    {/* Trend arrow */}
    <path d="M58 248 Q100 220 148 185 L160 170" stroke="#1d4ed8" strokeWidth="2.5" strokeLinecap="round" fill="none" strokeDasharray="0" />
    <path d="M152 166 L164 170 L158 182" fill="#1d4ed8" />

    {/* Up arrow accent */}
    <circle cx="192" cy="185" r="18" fill="#2563eb" />
    <path d="M186 191 L192 178 L198 191" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <line x1="192" y1="179" x2="192" y2="194" stroke="white" strokeWidth="3" strokeLinecap="round" />

    {/* === Network nodes (center + right) === */}
    {/* Network connecting lines */}
    <line x1="258" y1="150" x2="330" y2="108" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="258" y1="150" x2="348" y2="170" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="258" y1="150" x2="320" y2="228" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="330" y1="108" x2="410" y2="96" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="348" y1="170" x2="416" y2="152" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="320" y1="228" x2="406" y2="232" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="410" y1="96" x2="416" y2="152" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />
    <line x1="416" y1="152" x2="406" y2="232" stroke="#bfdbfe" strokeWidth="1.5" strokeDasharray="5 4" />

    {/* Center hub node */}
    <circle cx="258" cy="150" r="30" fill="#dbeafe" />
    <circle cx="258" cy="150" r="20" fill="#3b82f6" />
    {/* Store icon in center */}
    <rect x="248" y="143" width="20" height="14" rx="3" fill="white" opacity="0.9" />
    <rect x="248" y="143" width="20" height="5" rx="3" fill="white" />
    <rect x="254" y="151" width="8" height="6" rx="1" fill="#3b82f6" />

    {/* Satellite node 1 — top right */}
    <circle cx="330" cy="108" r="22" fill="#dbeafe" />
    <circle cx="330" cy="108" r="14" fill="#60a5fa" />
    <rect x="323" y="103" width="14" height="10" rx="2" fill="white" opacity="0.85" />
    <rect x="323" y="103" width="14" height="4" rx="2" fill="white" />

    {/* Satellite node 2 — right middle */}
    <circle cx="348" cy="170" r="20" fill="#dbeafe" />
    <circle cx="348" cy="170" r="13" fill="#2563eb" />
    <rect x="342" y="165" width="12" height="10" rx="2" fill="white" opacity="0.85" />
    <rect x="342" y="165" width="12" height="4" rx="2" fill="white" />

    {/* Satellite node 3 — bottom */}
    <circle cx="320" cy="228" r="18" fill="#dbeafe" />
    <circle cx="320" cy="228" r="12" fill="#60a5fa" />
    <rect x="314" y="223" width="12" height="10" rx="2" fill="white" opacity="0.85" />
    <rect x="314" y="223" width="12" height="4" rx="2" fill="white" />

    {/* Outer ring nodes */}
    <circle cx="410" cy="96" r="16" fill="#bfdbfe" />
    <circle cx="410" cy="96" r="9" fill="#93c5fd" />

    <circle cx="416" cy="152" r="16" fill="#bfdbfe" />
    <circle cx="416" cy="152" r="9" fill="#3b82f6" />

    <circle cx="406" cy="232" r="16" fill="#bfdbfe" />
    <circle cx="406" cy="232" r="9" fill="#60a5fa" />

    {/* People / user icons above outer nodes */}
    <circle cx="440" cy="74" r="7" fill="#fde68a" />
    <ellipse cx="440" cy="88" rx="8" ry="5" fill="#2563eb" />

    <circle cx="444" cy="132" r="7" fill="#fde68a" />
    <ellipse cx="444" cy="146" rx="8" ry="5" fill="#2563eb" />

    {/* Growth % badge */}
    <rect x="228" y="80" width="60" height="26" rx="13" fill="#1d4ed8" />
    <rect x="236" y="87" width="44" height="12" rx="6" fill="#93c5fd" />

    {/* Sparkle dots */}
    <circle cx="66" cy="80" r="5" fill="#93c5fd" opacity="0.55" />
    <circle cx="440" cy="280" r="6" fill="#bfdbfe" opacity="0.65" />
    <circle cx="200" cy="52" r="4" fill="#60a5fa" opacity="0.5" />
  </svg>
);

export default IllustrationGrow;
