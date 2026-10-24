/**
 * brand-ink.js — A readable text colour for a brand colour (WCAG 2.x contrast).
 *
 *   brandInk('#2E7DE1') -> { color: '#FFFFFF', theme: 'dark', contrast: 4.11... }   (rounded to 2 decimals)
 *
 * `theme` is the theme of the tile the brand colour forms: 'dark' = a dark tile, so the ink is light;
 * 'light' = a light tile, so the ink is dark. `contrast` is the ratio of ink on brand colour, always >= 4.5 (WCAG AA, normal text).
 * White or near-black (#111111) is preferred; pure black is used only when neither reaches 4.5 (mid-tones).
 */
export const MIN_CONTRAST = 4.5;
const LIGHT = '#FFFFFF', DARK = '#111111', BLACK = '#000000';

const channel = (v) => { const s = v / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
export function luminance(hex) {
    const n = parseInt(hex.slice(1), 16);
    return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a, b) {
    const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
}
const round = (n) => Math.round(n * 100) / 100;

/** @param {string | null | undefined} brandColor #RRGGBB @returns {{ color: string, theme: 'light' | 'dark', contrast: number } | null} */
export function brandInk(brandColor) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(brandColor || '')) return null;
    const cl = contrast(brandColor, LIGHT), cd = contrast(brandColor, DARK);
    let color = cl >= cd ? LIGHT : DARK, c = Math.max(cl, cd);
    if (c < MIN_CONTRAST) { color = cl >= cd ? LIGHT : BLACK; c = color === LIGHT ? cl : contrast(brandColor, BLACK); if (c < MIN_CONTRAST) { color = c >= contrast(brandColor, LIGHT) ? BLACK : LIGHT; c = contrast(brandColor, color); } }
    if (c < MIN_CONTRAST) throw new Error(`no ink reaches ${MIN_CONTRAST}:1 on ${brandColor}`);
    return { color, theme: color === LIGHT ? 'dark' : 'light', contrast: round(c) };
}
