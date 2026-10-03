/**
 * domains.js — Intelligent Domain Mapping & Deduction for Indian Listed Companies
 */

export const KNOWN_DOMAINS = {
    'RELIANCE': 'ril.com',
    'TCS': 'www.tcs.com',
    'HDFCBANK': 'hdfcbank.com',
    'BHARTIARTL': 'airtel.in',
    'ICICIBANK': 'icicibank.com',
    'SBIN': 'sbi.co.in',
    'INFY': 'infosys.com',
    'BAJFINANCE': 'bajajfinserv.in',
    'LT': 'larsentoubro.com',
    'LICI': 'licindia.in',
    'SUNPHARMA': 'sunpharma.com',
    'HINDUNILVR': 'hul.co.in',
    'KOTAKBANK': 'kotak.com',
    'TITAN': 'titancompany.in',
    'ADANIPORTS': 'adaniports.com',
    'ADANIENT': 'adanienterprises.com',
    'ITC': 'itcportal.com',
    'AXISBANK': 'axisbank.com',
    'HCLTECH': 'hcltech.com',
    'WIPRO': 'wipro.com',
    'NTPC': 'ntpc.co.in',
    'ONGC': 'ongcindia.com',
    'TATAMOTORS': 'tatamotors.com',
    'TATASTEEL': 'tatasteel.com',
    'MARUTI': 'marutisuzuki.com',
    'POWERGRID': 'powergrid.in',
    'BAJAJFINSV': 'bajajfinserv.in',
    'COALINDIA': 'coalindia.in',
    'ULTRACEMCO': 'ultratechcement.com',
    'ASIANPAINT': 'asianpaints.com',
    'NESTLEIND': 'nestle.in',
    'SIEMENS': 'siemens.com',
    'IOC': 'iocl.com',
    'DMART': 'dmartindia.com',
    'ZOMATO': 'zomato.com',
    'SWIGGY': 'swiggy.com',
    'PAYTM': 'paytm.com',
    'JIOFIN': 'jiofinancialservices.com',
    'HAL': 'hal-india.co.in',
    'BEL': 'bel-india.in',
    'DLF': 'dlf.in',
    'VEDL': 'vedantalimited.com',
    'GRASIM': 'grasim.com',
    'TECHM': 'techmahindra.com',
    'JSWSTEEL': 'jsw.in',
    'INDIGO': 'goindigo.in',
    'EICHERMOT': 'royalenfield.com',
    'DRREDDY': 'drreddys.com',
    'CIPLA': 'cipla.com',
    'BRITANNIA': 'britannia.co.in',
    'HINDALCO': 'hindalco.com',
    'APOLLOHOSP': 'apollohospitals.com',
    'DIVISLAB': 'divislabs.com',
    'SHREECEM': 'shreecement.com',
    'BPCL': 'bharatpetroleum.in',
    'TRENT': 'mytrent.com',
    'ABB': 'abb.com',
    'CHOLAFIN': 'cholamandalam.com',
    'PIDILITIND': 'pidilite.com',
    'GODREJCP': 'godrejcp.com',
    'HAVELLS': 'havells.com',
    'DABUR': 'dabur.com',
    'AMBUJACEM': 'ambujacement.com',
    'LUPIN': 'lupin.com',
    'TVSMOTOR': 'tvsmotor.com',
    'BAJAJ-AUTO': 'bajajauto.com',
    'HEROMOTOCO': 'heromotocorp.com',
    'MOTHERSON': 'motherson.com',
    'BOSCHLTD': 'bosch.in',
    'VOLTAS': 'voltas.com',
    'POLYCAB': 'polycab.com',
    'TATACOMM': 'tatacommunications.com',
    'TATAPOWER': 'tatapower.com',
    'CUMMINSIND': 'cummins.com',
    'PERSISTENT': 'persistent.com',
    'LTTS': 'ltts.com',
    'MPHASIS': 'mphasis.com',
    'COFORGE': 'coforge.com',
    'KPITTECH': 'kpit.com',
    'OFSS': 'oracle.com',
    'PAGEIND': 'pageind.com',
    'COLPAL': 'colgatepalmolive.co.in',
    'MARICO': 'marico.com',
    'BERGEPAINT': 'bergerpaints.com',
    'MUTHOOTFIN': 'muthootfinance.com',
    'CANBK': 'canarabank.com',
    'BANKBARODA': 'bankofbaroda.in',
    'PNB': 'pnbindia.in',
    'UNIONBANK': 'unionbankofindia.co.in',
    'IDFCFIRSTB': 'idfcfirstbank.com',
    'FEDERALBNK': 'federalbank.co.in',
    'AUBANK': 'aubank.in',
    'INDUSINDBK': 'indusind.com',
    'YESBANK': 'yesbank.in',
    'BANDHANBNK': 'bandhanbank.com',
    'MAXHEALTH': 'maxhealthcare.in',
    'FORTIS': 'fortishealthcare.com',
    'BIOCON': 'biocon.com',
    'ALKEM': 'alkemlabs.com',
    'TORNTPHARM': 'torrentpharma.com',
    'AUROPHARMA': 'auropharma.com',
    'MANKIND': 'mankindpharma.com',
    'GLENMARK': 'glenmarkpharma.com',
    'IPCALAB': 'ipca.com',
    'ZYDUSLIFE': 'zyduslife.com',
    'PIIND': 'piindustries.com',
    'DEEPAKNTR': 'deepaknitrite.com',
    'ATGL': 'adani-totalgas.com',
    'ADANIGREEN': 'adanigreenenergy.com',
    'ADANIPOWER': 'adanipower.com',
    'AWL': 'adaniwilmar.com',
    'IRCTC': 'irctc.co.in',
    'RVNL': 'rvnl.org',
    'IRCON': 'ircon.org',
    'RAILTEL': 'railtelindia.com',
    'BHEL': 'bhel.com',
    'NMDC': 'nmdc.co.in',
    'SAIL': 'sail.co.in',
    'NATIONALUM': 'nalcoindia.com',
    'GAIL': 'gailonline.com',
    'PETRONET': 'petronetlng.in',
    'IGL': 'iglonline.net',
    'MGL': 'mahanagargas.com',
    'GUJGASLTD': 'gujaratgas.com',
    'PRESTIGE': 'prestigeconstructions.com',
    'GODREJPROP': 'godrejproperties.com',
    'OBEROIRLTY': 'oberoirealty.com',
    'PHOENIXLTD': 'thephoenixmills.com',
    'BRIGADE': 'brigadegroup.com',
    'SOBHA': 'sobha.com',
    'JUBLFOOD': 'jubilantfoodworks.com',
    'DEVYANI': 'dil-rjcorp.com',
    'WESTLIFE': 'westlife.co.in',
    'NYKAA': 'nykaa.com',
    'POLICYBZR': 'policybazaar.com',
    'DELHIVERY': 'delhivery.com',
    'MAPMYINDIA': 'mapmyindia.com',
    'NAUKRI': 'infoedge.in',
    'JUSTDIAL': 'justdial.com',
    'ROUTE': 'routemobile.com',
    'AFFLE': 'affle.com',
    'TANLA': 'tanla.com',
    'SONACOMS': 'sonacomstar.com',
    'UNOMINDA': 'unominda.com',
    'ENDURANCE': 'endurancegroup.com',
    'BALKRISIND': 'bkt-tires.com',
    'MRF': 'mrftyres.com',
    'APOLLOTYRE': 'apollotyres.com',
    'CEATLTD': 'ceat.com'
};

/**
 * Deduce a list of candidate domains to probe for a given symbol and company
 * @param {string} symbol
 * @param {string} companyName
 * @returns {string[]} Ordered list of candidate domains
 */
export function getCandidateDomains(symbol, companyName = '') {
    const sym = String(symbol || '').trim().toUpperCase();
    const candidates = [];

    // 1. Direct Known Mapping
    if (KNOWN_DOMAINS[sym]) {
        candidates.push(KNOWN_DOMAINS[sym]);
    }

    // 2. Clean Company Name Heuristics
    if (companyName) {
        const cleaned = companyName
            .toLowerCase()
            .replace(/\b(limited|ltd|pvt|corporation|corp|enterprises|industries|holdings|india)\b/gi, '')
            .replace(/[^a-z0-9]/g, '')
            .trim();

        if (cleaned.length >= 3 && cleaned.length <= 25) {
            candidates.push(`${cleaned}.com`);
            candidates.push(`${cleaned}.in`);
            candidates.push(`${cleaned}.co.in`);
        }
    }

    // 3. Clean Symbol Heuristics
    const cleanSym = sym.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (cleanSym.length >= 2) {
        candidates.push(`${cleanSym}.com`);
        candidates.push(`www.${cleanSym}.com`);
        candidates.push(`${cleanSym}.in`);
        candidates.push(`${cleanSym}.co.in`);
    }

    // Deduplicate while preserving order
    return Array.from(new Set(candidates));
}
