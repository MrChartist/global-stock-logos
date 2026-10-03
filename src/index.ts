export { StockLogo } from './StockLogo.js';
export type { StockLogoProps, StockMarket } from './StockLogo.js';

/**
 * Returns direct jsDelivr CDN URLs for any Indian or US stock symbol
 */
export function getGlobalStockLogoUrls(
  symbol: string, 
  market: 'IN' | 'US' | 'AUTO' = 'AUTO', 
  repo: string = 'MrChartist/global-stock-logos'
) {
  const sym = (symbol || 'NA').toUpperCase().trim().replace(/[^A-Za-z0-9_.-]/g, '');
  const mkt = market === 'AUTO' ? '' : market.toLowerCase();
  const cdnBase = `https://cdn.jsdelivr.net/gh/${repo}@main/logos`;

  return {
    directSvg: `${cdnBase}/${sym}.svg`,
    directPng: `${cdnBase}/${sym}.png`,
    marketSvg: mkt ? `${cdnBase}/${mkt}/${sym}.svg` : null,
    marketPng: mkt ? `${cdnBase}/${mkt}/${sym}.png` : null,
    manifest: `https://cdn.jsdelivr.net/gh/${repo}@main/logos-manifest.json`
  };
}
