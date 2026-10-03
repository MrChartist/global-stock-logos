import React, { useState } from 'react';

/** 'AUTO', or any market folder name in logos/ (e.g. 'us', 'in', 'uk', 'japan', 'korea'). Case-insensitive. */
export type StockMarket = string;

export interface StockLogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  symbol: string;
  market?: StockMarket; // 'AUTO' (default) or a market folder such as 'us', 'in', 'uk', 'japan'
  companyName?: string;
  size?: number;
  className?: string;
  cdnRepo?: string; // Default: 'MrChartist/global-stock-logos'
  showBadgeFallback?: boolean;
}

/**
 * Deterministic color generator for monogram badge
 */
function getMonogramStyle(symbol: string, size: number) {
  const sym = (symbol || 'STK').toUpperCase();
  let hash = 0;
  for (let i = 0; i < sym.length; i++) {
    hash = (hash << 5) - hash + sym.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash * 37) % 360;
  return {
    width: size,
    height: size,
    background: `linear-gradient(135deg, hsl(${hue}, 70%, 45%), hsl(${(hue + 45) % 360}, 75%, 25%))`,
  };
}

/**
 * Universal Global StockLogo Component
 * Supports India (NSE/BSE), US (NASDAQ/NYSE/S&P 500), and Global Equities
 * Implements a resilient 5-tier waterfall:
 * 1. jsDelivr Market SVG (logos/{market}/{sym}.svg)
 * 2. jsDelivr Market PNG (logos/{market}/{sym}.png)
 * 3. jsDelivr Direct Flat SVG (logos/{sym}.svg)
 * 4. jsDelivr Direct Flat PNG (logos/{sym}.png)
 * 5. Procedural vector monogram badge (100% zero broken images guarantee)
 */
export const StockLogo: React.FC<StockLogoProps> = ({
  symbol,
  market = 'AUTO',
  companyName = '',
  size = 32,
  className = '',
  cdnRepo = 'MrChartist/global-stock-logos',
  showBadgeFallback = true,
  style,
  alt,
  ...rest
}) => {
  const [sourceIndex, setSourceIndex] = useState(0);
  const sym = (symbol || 'NA').toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');

  const mkt = market.toUpperCase() === 'AUTO' ? '' : market.toLowerCase();
  const baseUrl = `https://cdn.jsdelivr.net/gh/${cdnRepo}@main/logos`;

  const sources: string[] = [];
  if (mkt) {
    sources.push(`${baseUrl}/${mkt}/${sym}.svg`);
    sources.push(`${baseUrl}/${mkt}/${sym}.png`);
  }
  sources.push(`${baseUrl}/${sym}.svg`);
  sources.push(`${baseUrl}/${sym}.png`);
  if (mkt === 'in' || !mkt) {
    sources.push(`${baseUrl}/in/${sym}.svg`);
    sources.push(`${baseUrl}/in/${sym}.png`);
  }
  if (mkt === 'us' || !mkt) {
    sources.push(`${baseUrl}/us/${sym}.svg`);
    sources.push(`${baseUrl}/us/${sym}.png`);
  }

  // If all CDN sources fail or image errors out, render procedural badge
  if (sourceIndex >= sources.length) {
    if (!showBadgeFallback) return null;
    const monogramStyle = getMonogramStyle(sym, size);
    return (
      <div
        style={{ ...monogramStyle, ...style }}
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-white font-bold text-xs uppercase shadow-xs select-none ${className}`}
        title={`${sym} - ${companyName || 'Stock'}`}
        aria-label={`${sym} logo`}
      >
        {sym.slice(0, 2)}
      </div>
    );
  }

  return (
    <img
      src={sources[sourceIndex]}
      alt={alt || `${sym} logo`}
      width={size}
      height={size}
      onError={() => setSourceIndex((prev) => prev + 1)}
      loading="lazy"
      style={{ width: size, height: size, ...style }}
      className={`rounded-full object-contain bg-white/5 border border-slate-700/30 shrink-0 ${className}`}
      {...rest}
    />
  );
};
