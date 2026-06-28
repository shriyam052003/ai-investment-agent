/**
 * Shared TypeScript types for the AI Investment Research Agent state.
 *
 * This file defines the core data structures used across the LangGraph
 * agent pipeline — from initial query through router, parallel research
 * (financials, news, risks), committee verdict, critique, and final output.
 */

// ─── Sub-types for Reports ──────────────────────────────────────────────────

/** Detailed financial report compiled from Alpha Vantage OVERVIEW and INCOME_STATEMENT endpoints. */
export interface FinancialsReport {
  /** Total annual or quarterly revenue. */
  revenue: number | null;
  /** Year-over-year (YoY) or annual revenue growth rate. */
  revenueGrowth: number | null;
  /** Net income margin percentage (Net Income / Total Revenue). */
  netMargin: number | null;
  /** Price-to-Earnings (P/E) ratio. */
  peRatio: number | null;
  /** Debt-to-Equity (D/E) ratio. */
  debtToEquity: number | null;
  /** Description or trend analysis of free cash flow (FCF) over recent periods. */
  freeCashFlowTrend: string | null;
  /** Short, analyst-style summary describing the company's financial health. */
  analystSummary: string;
  /** Confidence or data quality indicator (e.g., in case of missing metrics or symbol issues). */
  dataQuality: "high" | "medium" | "low" | "none";
}

/** Individual news article details. */
export interface NewsItem {
  /** The headline or title of the news article. */
  headline: string;
  /** The publisher or news source name. */
  source: string;
  /** The URL link to the original article source. */
  url: string;
  /** Sentiment rating of the news article. */
  sentiment: "positive" | "neutral" | "negative";
  /** A brief summary of the article. */
  summary: string;
}

/** Synthesized news and sentiment report compiled from web search results. */
export interface NewsReport {
  /** Collection of relevant news articles analyzed. */
  articles: NewsItem[];
  /** Overall narrative summarizing news sentiment for the target company. */
  overallSentimentSummary: string;
}

/** Individual risk factor identified for the company. */
export interface RiskItem {
  /** The category or title of the risk flag. */
  flag: string;
  /** Severity level indicating the impact/likelihood of the risk. */
  severity: "low" | "medium" | "high";
  /** Descriptive explanation of why this is a risk factor. */
  description: string;
}

/** Synthesized risk report highlighting key concerns. */
export interface RiskReport {
  /** Collection of identified risk items. */
  risks: RiskItem[];
  /** Overall summary of the company's risk profile. */
  overallRiskSummary: string;
}

// ─── Verdicts & Critique ────────────────────────────────────────────────────

/** Discriminated union of possible investment decisions. */
export type DecisionType = "invest" | "pass" | "watch";

/** The consensus verdict reached by the investment committee. */
export interface CommitteeVerdict {
  /** The investment decision made by the committee. */
  decision: DecisionType;
  /** Confidence level of the decision, between 0 (no confidence) and 1 (absolute certainty). */
  confidence: number;
  /** Deep narrative reasoning explaining the rationale behind the decision. */
  reasoning: string;
  /** List of primary driving factors behind the decision. */
  keyFactors: string[];
}

/** Critique and validation feedback of the committee verdict. */
export interface Critique {
  /** Indicates if the committee's verdict was approved by the critique process. */
  approved: boolean;
  /** List of specific questions, concerns, or gaps identified in the verdict. */
  concerns: string[];
  /** Instructions on how the committee should revise their verdict, if not approved. */
  revisionInstructions?: string;
}

/** A record of a previous critique-loop iteration. */
export interface RevisionRecord {
  /** The index of the revision (e.g. 1). */
  revisionNumber: number;
  /** The committee's verdict prior to the critique. */
  previousVerdict: CommitteeVerdict;
  /** The critique feedback received. */
  critique: Critique;
}

/** The final decision returned to the client, documenting any loop iterations. */
export interface FinalVerdict extends CommitteeVerdict {
  /** History of the revision loops, showing prior verdicts and critiques. */
  revisionHistory: RevisionRecord[];
}

// ─── Logging & Telemetry ────────────────────────────────────────────────────

/** An append-only trace log entry of an agent node's progress. */
export interface TraceEvent {
  /** The ID of the node that generated this event (e.g., "router", "financials"). */
  nodeId: string;
  /** The status of the node at the time of trace emission. */
  status: "started" | "completed" | "error";
  /** Epoch timestamp in milliseconds. */
  timestamp: number;
  /** Human-readable message describing the progress (e.g., "Pulled 4 quarters of financials for AAPL"). */
  summary: string;
  /** Additional structured data or payload associated with the trace event. */
  detail?: unknown;
}

// ─── Research State ─────────────────────────────────────────────────────────

/** The top-level state object that flows through the LangGraph graph. */
export interface ResearchState {
  /** The raw company name or query entered by the user. */
  companyName: string;

  /** The resolved stock symbol (ticker) or null if resolution fails. */
  resolvedTicker: string | null;

  /** Basic company profile details resolved during symbol extraction. */
  companyContext: {
    sector?: string;
    exchange?: string;
  };

  /** The financials report compiled by the Financials node. */
  financialsReport: FinancialsReport | null;

  /** The news and sentiment report compiled by the News node. */
  newsReport: NewsReport | null;

  /** The risk report compiled by the Risk node. */
  riskReport: RiskReport | null;

  /** The draft verdict reached by the Committee node. */
  committeeVerdict: CommitteeVerdict | null;

  /** The evaluation report generated by the Critique node. */
  critique: Critique | null;

  /** The current count of revisions/loops performed (maximum of 1 allowed). */
  revisionCount: number;

  /** The final approved investment decision and research summary. */
  finalVerdict: FinalVerdict | null;

  /** An append-only log of agent actions, used for real-time progress streaming. */
  traceEvents: TraceEvent[];
}
