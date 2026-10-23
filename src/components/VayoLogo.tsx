import React from 'react';

interface VayoLogoProps {
  size?: number; // Target height in pixels (the whole logo will scale proportionally based on viewBox 1200x520)
  theme?: 'light' | 'dark';
  className?: string;
}

export default function VayoLogo({ size = 110, theme = 'dark', className = "" }: VayoLogoProps) {
  const height = size;
  const width = size * (1200 / 520);

  // Generate unique IDs for gradients to prevent namespace collisions
  const textGradId = `vayoTextGrad-${theme}`;
  const smileGradId = `vayoSmileGrad-${theme}`;

  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 1200 520" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none ${className}`}
      style={{ 
        overflow: 'visible',
        filter: theme === 'dark' ? 'drop-shadow(0 0 18px rgba(120, 220, 255, 0.18))' : 'none'
      }}
    >
      <defs>
        {/* Text Gradient */}
        {theme === 'dark' ? (
          <linearGradient id={textGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5d74ff" />
            <stop offset="45%" stopColor="#9defff" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>
        ) : (
          <linearGradient id={textGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="45%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        )}

        {/* Smile Gradient */}
        {theme === 'dark' ? (
          <linearGradient id={smileGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#5d74ff" />
            <stop offset="100%" stopColor="#8effff" />
          </linearGradient>
        ) : (
          <linearGradient id={smileGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0891b2" />
          </linearGradient>
        )}
      </defs>

      {/* TEXT GRP */}
      <g>
        {/* V (Left edge: 180, Right edge: 450) */}
        <path 
          d="M180 120 L240 120 L315 320 L390 120 L450 120 L345 395 L285 395 Z" 
          fill={`url(#${textGradId})`} 
        />

        {/* A (Shifted left by -125px for perfect kerning: Left edge: 375, Right edge: 690) */}
        <path 
          d="M375 395 L495 120 L570 120 L690 395 L625 395 L595 325 L465 325 L435 395 Z M530 180 L485 285 L575 285 Z" 
          fill={`url(#${textGradId})`} 
          fillRule="evenodd" 
        />

        {/* Y (Shifted left by -200px for perfect spacing: Left edge: 590, Right edge: 890) */}
        <path 
          d="M590 120 L660 120 L740 235 L820 120 L890 120 L775 280 L775 395 L715 395 L715 280 Z" 
          fill={`url(#${textGradId})`} 
        />

        {/* O OUTER (Shifted left by -115px to sit beautifully near Y: Center cx: 965, Left edge: 845, Right edge: 1085) */}
        <circle cx="965" cy="250" r="120" fill={`url(#${textGradId})`} />

        {/* O INNER */}
        <circle cx="965" cy="250" r="62" fill={theme === 'dark' ? '#000000' : '#1e1b4b'} />

        {/* EYES */}
        <circle cx="935" cy="250" r="10" fill="#ffffff" />
        <circle cx="995" cy="250" r="10" fill="#ffffff" />
      </g>

      {/* SMILE SWOOSH */}
      <g>
        <path 
          d="M360 345 C520 470, 800 480, 1015 355" 
          fill="none" 
          stroke={`url(#${smileGradId})`} 
          strokeWidth="22" 
          strokeLinecap="round" 
        />

        {/* ARROW */}
        <path 
          d="M990 330 L1060 315 L1028 380 Z" 
          fill={`url(#${smileGradId})`} 
        />
      </g>
    </svg>
  );
}
