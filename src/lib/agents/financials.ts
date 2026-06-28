import { ResearchState, TraceEvent, FinancialsReport } from "../types";
import { getCompanyOverview, getIncomeStatement } from "../tools/alphaVantage";
import { FAST_MODEL } from "./gemini";
import { FinancialsReportSchema, generateValidatedStructuredOutput } from "./validation";

const financialsSchema = {
  type: "object",
  properties: {
    revenue: { type: "number", description: "Total annual or quarterly revenue in USD (or local currency), or null if unavailable." },
    revenueGrowth: { type: "number", description: "Year-over-year or annual revenue growth rate as a decimal (e.g. 0.12 for 12%), or null." },
    netMargin: { type: "number", description: "Net income margin percentage as a decimal (e.g. 0.15 for 15%), or null." },
    peRatio: { type: "number", description: "Price-to-Earnings ratio, or null." },
    debtToEquity: { type: "number", description: "Debt-to-Equity ratio as a decimal, or null." },
    freeCashFlowTrend: { type: "string", description: "Short description of the free cash flow trend over the last few periods." },
    analystSummary: { type: "string", description: "Short analyst-style summary describing the company's financial health, growth, profitability, and valuation." },
    dataQuality: { type: "string", enum: ["high", "medium", "low", "none"], description: "Overall confidence in the completeness of the financial data." }
  },
  required: ["revenue", "revenueGrowth", "netMargin", "peRatio", "debtToEquity", "freeCashFlowTrend", "analystSummary", "dataQuality"]
};

/**
 * Financials Agent Node: Pulls overview and income statements from Alpha Vantage,
 * then uses Gemini to analyze fundamentals and produce a structured FinancialsReport.
 */
export async function financialsAgentNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const symbol = state.resolvedTicker;
  const timestamp = Date.now();

  const startEvent: TraceEvent = {
    nodeId: "financials",
    status: "started",
    timestamp,
    summary: symbol 
      ? `Fetching financial data for ticker: ${symbol}`
      : `Skipping financials lookup (no ticker resolved for "${state.companyName}")`,
  };

  // Fallback / default degraded report if there's no ticker or call fails
  const fallbackReport: FinancialsReport = {
    revenue: null,
    revenueGrowth: null,
    netMargin: null,
    peRatio: null,
    debtToEquity: null,
    freeCashFlowTrend: "Unavailable",
    analystSummary: symbol 
      ? "Financial data fetch failed due to API limits or errors."
      : "Financial data is unavailable because the company ticker could not be resolved.",
    dataQuality: "none",
  };

  if (!symbol) {
    const completeEvent: TraceEvent = {
      nodeId: "financials",
      status: "completed",
      timestamp: Date.now(),
      summary: "Financials report skipped (ticker unresolved). Using fallback data.",
      detail: fallbackReport,
    };
    return {
      financialsReport: fallbackReport,
      traceEvents: [startEvent, completeEvent],
    };
  }

  try {
    console.log(`[Financials Node] Fetching financials for ${symbol}...`);
    
    // Fetch Overview and Income Statement
    const overviewRes = await getCompanyOverview(symbol);
    const incomeRes = await getIncomeStatement(symbol);

    const isOverviewUnavailable = overviewRes.dataQuality === "none" || !overviewRes.data;
    const isIncomeUnavailable = incomeRes.dataQuality === "none" || !incomeRes.quarterlyReports || incomeRes.quarterlyReports.length === 0;

    console.log(`[Financials Node] Analysis with Gemini for ${symbol}...`);
    
    const prompt = `
You are an expert fundamental investment analyst. Analyze the following raw financial data from Alpha Vantage for ${symbol}.
Company Sector: ${state.companyContext.sector || "Unknown"}
Exchange: ${state.companyContext.exchange || "Unknown"}

--- RAW OVERVIEW DATA ---
${JSON.stringify(overviewRes.data || { note: "Overview data unavailable / rate limit hit" }, null, 2)}

--- RAW INCOME STATEMENT DATA (LAST 4 QUARTERS) ---
${JSON.stringify(incomeRes.quarterlyReports || { note: "Income statement data unavailable / rate limit hit" }, null, 2)}

--- CRITICAL RULES & INSTRUCTIONS ---
1. DO NOT HALLUCINATE OR FABRICATE ANY NUMBERS. If data fields are missing, set the corresponding metric to null (e.g. revenue: null, peRatio: null) and report "data not available" in the summaries.
2. If both reports are unavailable or return rate limit indicators, you MUST set dataQuality to "none" and indicate that the financial records were unavailable.
3. Extract key metrics: revenue (annual/quarterly), revenue growth rate (YoY), net profit margin, Price-to-Earnings (P/E) ratio, Debt-to-Equity (D/E) ratio, and Free Cash Flow trends.
4. Write a concise, professional analyst summary.
5. Set dataQuality based on what was actually received:
   - "high": Both overview and income statements are fully populated.
   - "medium": One of overview or income statement has missing fields but overall trends are clear.
   - "low": Significant missing fields or empty reports.
   - "none": If no numerical data was returned at all (e.g., rate limit hit).

Provide your final output in structured JSON.
`;

    // Use our validation wrapper instead of simple JSON.parse
    const report = await generateValidatedStructuredOutput(
      FAST_MODEL,
      FinancialsReportSchema,
      financialsSchema,
      prompt,
      fallbackReport
    );

    const completeEvent: TraceEvent = {
      nodeId: "financials",
      status: "completed",
      timestamp: Date.now(),
      summary: report.analystSummary,
      detail: report,
    };

    return {
      financialsReport: report,
      traceEvents: [startEvent, completeEvent],
    };

  } catch (error: any) {
    console.error(`[Financials Node] Error:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "financials",
      status: "error",
      timestamp: Date.now(),
      summary: `Failed to compile financials report: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      financialsReport: fallbackReport,
      traceEvents: [startEvent, errorEvent],
    };
  }
}
