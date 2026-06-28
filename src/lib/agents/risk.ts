import { ResearchState, TraceEvent, RiskReport } from "../types";
import { searchNews } from "../tools/tavily";
import { FAST_MODEL } from "./gemini";
import { RiskReportSchema, generateValidatedStructuredOutput } from "./validation";

const riskSchema = {
  type: "object",
  properties: {
    risks: {
      type: "array",
      description: "List of the key risk factors identified for the company.",
      items: {
        type: "object",
        properties: {
          flag: { type: "string", description: "Short title or flag representing the risk category (e.g. 'Regulatory Legal', 'Competition')." },
          severity: { type: "string", enum: ["low", "medium", "high"], description: "The severity/impact level of this risk." },
          description: { type: "string", description: "Detailed description of the risk factor and why it's a concern." }
        },
        required: ["flag", "severity", "description"]
      }
    },
    overallRiskSummary: {
      type: "string",
      description: "Synthesis of the overall risk profile and the biggest roadblocks to investing."
    }
  },
  required: ["risks", "overallRiskSummary"]
};

/**
 * Risk Agent Node: Searches Tavily for controversies, lawsuits, regulatory issues,
 * and competitor threats, then uses Gemini to draft a skeptical RiskReport.
 */
export async function riskAgentNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const companyName = state.companyName;
  const ticker = state.resolvedTicker;
  const searchQuery = ticker ? `${companyName} (${ticker})` : companyName;
  const timestamp = Date.now();

  const startEvent: TraceEvent = {
    nodeId: "risk",
    status: "started",
    timestamp,
    summary: `Searching risk factors, lawsuits, and competitive threats for "${searchQuery}"`,
  };

  const fallbackReport: RiskReport = {
    risks: [],
    overallRiskSummary: "Risk analysis search failed or returned no results.",
  };

  try {
    console.log(`[Risk Node] Running risk Tavily search for "${searchQuery}"...`);
    const results = await searchNews(
      searchQuery,
      "lawsuits, regulatory action, controversy, executive turnover, accounting concerns, competitive threats"
    );

    if (results.length === 0) {
      console.warn(`[Risk Node] No search results returned for "${searchQuery}".`);
      const completeEvent: TraceEvent = {
        nodeId: "risk",
        status: "completed",
        timestamp: Date.now(),
        summary: "No specific risk factors found in search results.",
        detail: fallbackReport,
      };
      return {
        riskReport: fallbackReport,
        traceEvents: [startEvent, completeEvent],
      };
    }

    console.log(`[Risk Node] Analyzing ${results.length} risk results with Gemini...`);

    const prompt = `
You are a highly skeptical, detail-oriented risk analyst. Your job is to find reasons NOT to invest in "${searchQuery}". 
Analyze the following search results and compile a structured RiskReport.

--- WEB SEARCH RESULTS ---
${JSON.stringify(results, null, 2)}

--- CRITICAL RULES & INSTRUCTIONS ---
1. DO NOT HALLUCINATE OR INVENT CONTESTED CLAIMS, LAWSUITS, OR RISK METRICS.
2. If there are no relevant risks found in the search results, return an empty array for risks and explicitly note in the overallRiskSummary that "no documented public controversies or legal risks were detected in the web search findings".
3. Identify the most significant risk factors (e.g. legal issues, regulatory hurdles, executive turnover, competitive threats, macro headwinds, accounting concerns).
4. Assign a severity level ("low", "medium", "high") to each.
5. Write a skeptical, balanced overall risk summary. Avoid optimism bias.

Provide your final output in structured JSON.
`;

    // Validate using Zod schemas
    const report = await generateValidatedStructuredOutput(
      FAST_MODEL,
      RiskReportSchema,
      riskSchema,
      prompt,
      fallbackReport
    );

    const completeEvent: TraceEvent = {
      nodeId: "risk",
      status: "completed",
      timestamp: Date.now(),
      summary: report.overallRiskSummary,
      detail: report,
    };

    return {
      riskReport: report,
      traceEvents: [startEvent, completeEvent],
    };

  } catch (error: any) {
    console.error(`[Risk Node] Error:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "risk",
      status: "error",
      timestamp: Date.now(),
      summary: `Failed to compile risk report: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      riskReport: fallbackReport,
      traceEvents: [startEvent, errorEvent],
    };
  }
}
