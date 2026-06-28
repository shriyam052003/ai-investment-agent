import { ResearchState, TraceEvent } from "../types";
import { resolveTicker, getCompanyOverview } from "../tools/alphaVantage";

/**
 * Router Node: Resolves the company name to a ticker symbol using SYMBOL_SEARCH
 * and gets basic exchange/sector context.
 */
export async function routerNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const companyName = state.companyName;
  const timestamp = Date.now();
  
  const startEvent: TraceEvent = {
    nodeId: "router",
    status: "started",
    timestamp,
    summary: `Resolving ticker for company: "${companyName}"`,
  };

  try {
    console.log(`[Router Node] Resolving ticker for "${companyName}"...`);
    const resolution = await resolveTicker(companyName);

    if (!resolution.symbol) {
      const errorMsg = `Could not resolve ticker for "${companyName}". ${resolution.note || ""}`;
      console.warn(`[Router Node] ${errorMsg}`);
      
      const completeEvent: TraceEvent = {
        nodeId: "router",
        status: "completed",
        timestamp: Date.now(),
        summary: `Symbol search returned no ticker for "${companyName}". Reverting to news-only mode.`,
        detail: resolution,
      };

      return {
        resolvedTicker: null,
        companyContext: {},
        traceEvents: [startEvent, completeEvent],
      };
    }

    console.log(`[Router Node] Best ticker match: ${resolution.symbol} (${resolution.name})`);
    
    // Attempt to fetch company overview for sector and exchange
    let sector: string | undefined;
    let exchange: string | undefined;
    
    const overviewRes = await getCompanyOverview(resolution.symbol);
    if (overviewRes.data) {
      sector = overviewRes.data.Sector;
      exchange = overviewRes.data.Exchange;
    }

    const summary = `Resolved "${companyName}" to ticker ${resolution.symbol} (${resolution.name || "Unknown Name"}) on ${exchange || "Unknown Exchange"}.`;
    
    const completeEvent: TraceEvent = {
      nodeId: "router",
      status: "completed",
      timestamp: Date.now(),
      summary,
      detail: { resolution, sector, exchange },
    };

    return {
      resolvedTicker: resolution.symbol,
      companyContext: { sector, exchange },
      traceEvents: [startEvent, completeEvent],
    };
  } catch (error: any) {
    console.error(`[Router Node] Error resolving ticker:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "router",
      status: "error",
      timestamp: Date.now(),
      summary: `Failed to resolve ticker: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      resolvedTicker: null,
      companyContext: {},
      traceEvents: [startEvent, errorEvent],
    };
  }
}
