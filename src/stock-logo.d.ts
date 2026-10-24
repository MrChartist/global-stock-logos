export declare const DEFAULT_BASE_URL: string;
export declare function parseSymbol(input: { symbol?: string | null; market?: string | null }): { market: string; ticker: string } | null;
export declare function logoCandidates(baseUrl: string, market: string, ticker: string): string[];
export declare function initials(text: string): string;
export declare class StockLogoElement extends HTMLElement {
    static readonly observedAttributes: string[];
    readonly size: number;
    readonly baseUrl: string;
}
declare global {
    interface HTMLElementTagNameMap { 'stock-logo': StockLogoElement; }
    interface HTMLElementEventMap {
        'stock-logo-load': CustomEvent<{ market: string; ticker: string; url: string }>;
        'stock-logo-error': CustomEvent<{ market: string; ticker: string; tried: string[] }>;
    }
}
