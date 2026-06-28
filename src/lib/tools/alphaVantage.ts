/**
 * Alpha Vantage API tool wrapper.
 * Handles symbol resolution, overview metrics, and income statements.
 *
 * Alpha Vantage free tier is limited to 5 requests per minute and 500 requests per day.
 * To respect this, we implement a serialized queuing mechanism with a minimum spacing
 * of 12 seconds between consecutive requests.
 */

// Serialized API request queue to respect 5 req/min (12s intervals)
let requestQueue = Promise.resolve();
let lastCallTime = 0;
const MIN_INTERVAL = 12000; // 12 seconds in milliseconds

/**
 * Utility to make rate-limited and spaced requests to Alpha Vantage.
 */
async function rateLimitedFetch(url: string): Promise<any> {
  const currentRequest = requestQueue.then(async () => {
    const now = Date.now();
    const timeSinceLast = now - lastCallTime;
    if (timeSinceLast < MIN_INTERVAL) {
      const waitTime = MIN_INTERVAL - timeSinceLast;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
    lastCallTime = Date.now();
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Alpha Vantage HTTP error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  });

  // Ensure queue continues even if the current request fails
  requestQueue = currentRequest.then(() => {}).catch(() => {});

  return currentRequest;
}

export interface CompanyOverviewResult {
  data: {
    Symbol?: string;
    AssetType?: string;
    Name?: string;
    Description?: string;
    Exchange?: string;
    Currency?: string;
    Country?: string;
    Sector?: string;
    Industry?: string;
    MarketCapitalization?: string;
    PERatio?: string;
    PEGRatio?: string;
    BookValue?: string;
    DividendPerShare?: string;
    DividendYield?: string;
    EPS?: string;
    RevenuePerShareTTM?: string;
    ProfitMargin?: string;
    OperatingMarginTTM?: string;
    ReturnOnAssetsTTM?: string;
    ReturnOnEquityTTM?: string;
    RevenueTTM?: string;
    GrossProfitTTM?: string;
    DilutedEPSTTM?: string;
    QuarterlyEarningsGrowthYOY?: string;
    QuarterlyRevenueGrowthYOY?: string;
    AnalystTargetPrice?: string;
    TrailingPE?: string;
    ForwardPE?: string;
    PriceToSalesRatioTTM?: string;
    PriceToBookRatio?: string;
    EVToRevenue?: string;
    EVToEBITDA?: string;
    Beta?: string;
    SharesOutstanding?: string;
    DividendDate?: string;
    ExDividendDate?: string;
  } | null;
  dataQuality: "high" | "none";
  error?: string;
}

export interface QuarterlyReport {
  fiscalDateEnding: string;
  totalRevenue: string;
  netIncome: string;
}

export interface IncomeStatementResult {
  quarterlyReports: QuarterlyReport[];
  dataQuality: "high" | "none";
  error?: string;
}

export interface TickerResolution {
  symbol: string | null;
  name: string | null;
  matchScore: number;
  note?: string;
}

/**
 * Resolves a company name to a ticker symbol using SYMBOL_SEARCH.
 */
export async function resolveTicker(companyName: string): Promise<TickerResolution> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.warn("Alpha Vantage: ALPHA_VANTAGE_API_KEY not defined.");
    return { symbol: null, name: null, matchScore: 0, note: "API Key missing" };
  }

  const url = `https://www.alphavantage.co/query?function=SYMBOL_SEARCH&keywords=${encodeURIComponent(companyName)}&apikey=${apiKey}`;

  try {
    const data = await rateLimitedFetch(url);

    if (data.Note) {
      return { symbol: null, name: null, matchScore: 0, note: `Rate limit hit: ${data.Note}` };
    }
    if (data["Error Message"]) {
      return { symbol: null, name: null, matchScore: 0, note: `API Error: ${data["Error Message"]}` };
    }

    const matches = data.bestMatches;
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return { symbol: null, name: null, matchScore: 0, note: "No matches found" };
    }

    // Best match is the first item
    const bestMatch = matches[0];
    const symbol = bestMatch["1. symbol"] || null;
    const name = bestMatch["2. name"] || null;
    const matchScore = parseFloat(bestMatch["9. matchScore"]) || 0;

    let note = `Match score: ${matchScore}`;
    if (matches.length > 1) {
      note += `. Ambiguous: found ${matches.length} other potential options (e.g. ${matches.slice(1, 3).map((m: any) => m["1. symbol"]).join(", ")})`;
    }

    return { symbol, name, matchScore, note };
  } catch (error: any) {
    console.warn(`Alpha Vantage resolveTicker failed for "${companyName}":`, error);
    return { symbol: null, name: null, matchScore: 0, note: error?.message || "Unknown error" };
  }
}

/**
 * Calls OVERVIEW endpoint to pull key company metrics.
 */
export async function getCompanyOverview(symbol: string): Promise<CompanyOverviewResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.warn("Alpha Vantage: ALPHA_VANTAGE_API_KEY not defined.");
    return { data: null, dataQuality: "none", error: "API Key missing" };
  }

  const url = `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

  try {
    const data = await rateLimitedFetch(url);

    if (data.Note) {
      return { data: null, dataQuality: "none", error: `Rate limit hit: ${data.Note}` };
    }
    if (data["Error Message"]) {
      return { data: null, dataQuality: "none", error: `API Error: ${data["Error Message"]}` };
    }
    if (!data || Object.keys(data).length === 0) {
      return { data: null, dataQuality: "none", error: "Empty overview response" };
    }

    return {
      data,
      dataQuality: "high",
    };
  } catch (error: any) {
    console.warn(`Alpha Vantage getCompanyOverview failed for "${symbol}":`, error);
    return { data: null, dataQuality: "none", error: error?.message || "Unknown error" };
  }
}

/**
 * Calls INCOME_STATEMENT endpoint to pull revenue and income history for trend analysis.
 */
export async function getIncomeStatement(symbol: string): Promise<IncomeStatementResult> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  if (!apiKey) {
    console.warn("Alpha Vantage: ALPHA_VANTAGE_API_KEY not defined.");
    return { quarterlyReports: [], dataQuality: "none", error: "API Key missing" };
  }

  const url = `https://www.alphavantage.co/query?function=INCOME_STATEMENT&symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;

  try {
    const data = await rateLimitedFetch(url);

    if (data.Note) {
      return { quarterlyReports: [], dataQuality: "none", error: `Rate limit hit: ${data.Note}` };
    }
    if (data["Error Message"]) {
      return { quarterlyReports: [], dataQuality: "none", error: `API Error: ${data["Error Message"]}` };
    }
    
    const quarterlyReportsRaw = data.quarterlyReports;
    if (!quarterlyReportsRaw || !Array.isArray(quarterlyReportsRaw)) {
      return { quarterlyReports: [], dataQuality: "none", error: "No quarterly reports found" };
    }

    // Get last 4 quarters
    const lastFourQuarters = quarterlyReportsRaw.slice(0, 4).map((report: any) => ({
      fiscalDateEnding: report.fiscalDateEnding || "",
      totalRevenue: report.totalRevenue || "0",
      netIncome: report.netIncome || "0",
    }));

    return {
      quarterlyReports: lastFourQuarters,
      dataQuality: "high",
    };
  } catch (error: any) {
    console.warn(`Alpha Vantage getIncomeStatement failed for "${symbol}":`, error);
    return { quarterlyReports: [], dataQuality: "none", error: error?.message || "Unknown error" };
  }
}
