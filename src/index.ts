export { StockLogosClient, ApiError, DEFAULT_BASE_URL, rankRows } from './client.js';
export type { Company, CompanyRow, Market, SearchHit, ApiIndex, Person, IndexRow } from './client.js';
export { StockLogo } from './StockLogo.js';
export type { StockLogoProps, StockMarket } from './StockLogo.js';

/**
 * Returns direct jsDelivr CDN URLs for any stock symbol in any covered market
 */
export function getGlobalStockLogoUrls(
  symbol: string, 
  market: string = 'AUTO', 
  repo: string = 'MrChartist/global-stock-logos'
) {
  // Keep '&' (M&M, ARE&M have their own files) and encode it for the URL.
  const sym = encodeURIComponent((symbol || 'NA').toUpperCase().trim().replace(/[^A-Za-z0-9_.&-]/g, ''));
  const mkt = market.toUpperCase() === 'AUTO' ? '' : market.toLowerCase();
  const cdnBase = `https://cdn.jsdelivr.net/gh/${repo}@main/logos`;

  return {
    directSvg: `${cdnBase}/${sym}.svg`,
    directPng: `${cdnBase}/${sym}.png`,
    marketSvg: mkt ? `${cdnBase}/${mkt}/${sym}.svg` : null,
    marketPng: mkt ? `${cdnBase}/${mkt}/${sym}.png` : null,
    manifest: `https://cdn.jsdelivr.net/gh/${repo}@main/logos-manifest.json`
  };
}
