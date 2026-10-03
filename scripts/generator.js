/**
 * generator.js — Procedural Vector SVG Logo Generator
 * Generates an ultra-crisp, modern 1:1 vector SVG badge for any ticker symbol
 * using deterministic gradient styling and high-contrast typography.
 */

const PALETTES = [
    { from: '#2563eb', to: '#1d4ed8', text: '#ffffff' }, // Royal Blue
    { from: '#059669', to: '#047857', text: '#ffffff' }, // Emerald
    { from: '#7c3aed', to: '#6d28d9', text: '#ffffff' }, // Purple
    { from: '#ea580c', to: '#c2410c', text: '#ffffff' }, // Amber / Orange
    { from: '#0891b2', to: '#0e7490', text: '#ffffff' }, // Cyan
    { from: '#e11d48', to: '#be123c', text: '#ffffff' }, // Rose / Ruby
    { from: '#4f46e5', to: '#4338ca', text: '#ffffff' }, // Indigo
    { from: '#0d9488', to: '#0f766e', text: '#ffffff' }, // Teal
];

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

/**
 * Generate a standalone, pristine vector SVG string for a ticker symbol
 * @param {string} symbol - Stock ticker (e.g. 'NEWIPO', 'ZOMATO')
 * @param {string} [companyName] - Optional full company name
 * @returns {string} Clean SVG markup
 */
export function generateProceduralSvg(symbol, companyName = '') {
    const sym = String(symbol || 'STK').toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
    const hash = hashString(sym);
    const palette = PALETTES[hash % PALETTES.length];
    
    // Choose initials: if companyName has multiple words, take first letters, else first 2-3 of symbol
    let initials = sym.slice(0, 2);
    if (companyName && companyName.length > 3) {
        const words = companyName.split(/\s+/).filter(w => !/^(limited|ltd|pvt|corp|corporation|the|and|of|in|india)$/i.test(w));
        if (words.length >= 2) {
            initials = (words[0][0] + words[1][0]).toUpperCase();
        }
    }

    const fontSize = initials.length > 2 ? 80 : 96;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="grad-${sym}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${palette.from}" />
      <stop offset="100%" stop-color="${palette.to}" />
    </linearGradient>
    <filter id="shadow-${sym}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-opacity="0.2"/>
    </filter>
  </defs>
  <!-- Background Rounded Canvas -->
  <rect width="256" height="256" rx="56" fill="url(#grad-${sym})" filter="url(#shadow-${sym})"/>
  <!-- Subtle Internal Border -->
  <rect x="2" y="2" width="252" height="252" rx="54" fill="none" stroke="#ffffff" stroke-width="3" stroke-opacity="0.15"/>
  <!-- Brand Text -->
  <text 
    x="128" 
    y="142" 
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
    font-size="${fontSize}" 
    font-weight="800" 
    letter-spacing="-1.5"
    fill="${palette.text}" 
    text-anchor="middle" 
    dominant-baseline="middle">
    ${initials.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}
  </text>
  <!-- Micro ticker watermark at bottom -->
  <text 
    x="128" 
    y="218" 
    font-family="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" 
    font-size="20" 
    font-weight="700" 
    letter-spacing="2"
    fill="${palette.text}" 
    fill-opacity="0.6"
    text-anchor="middle">
    ${sym}
  </text>
</svg>`;
}
