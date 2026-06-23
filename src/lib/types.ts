/**
 * Shared TypeScript types for the AI Investment Research Agent state.
 *
 * This file defines the core data structures used across the LangGraph
 * agent pipeline — from initial query through research, analysis, and
 * final report generation.
 */

// ─── Agent State ────────────────────────────────────────────────────────────

/** The top-level state object that flows through the LangGraph graph. */
export interface AgentState {
  /** The user's original research query (e.g. "Analyze AAPL for long-term investment"). */
  query: string;

  /** The ticker symbol extracted or provided (e.g. "AAPL"). */
  ticker: string;

  /** Raw data collected by tool-calling nodes. */
  researchData: ResearchData;

  /** Structured analysis produced by the analysis node. */
  analysis: Analysis | null;

  /** The final markdown report returned to the user. */
  report: string;

  /** Tracks which agent steps have completed. */
  completedSteps: string[];

  /** Any errors encountered during execution. */
  errors: AgentError[];
}

// ─── Research Data ──────────────────────────────────────────────────────────

export interface ResearchData {
  /** Web search results from Tavily. */
  webSearchResults: WebSearchResult[];

  /** Financial data from Alpha Vantage. */
  financialData: FinancialData | null;
}

export interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export interface FinancialData {
  /** Company overview / profile information. */
  overview: Record<string, unknown> | null;

  /** Recent stock quote data. */
  quote: Record<string, unknown> | null;

  /** Time-series price history. */
  timeSeries: Record<string, unknown> | null;
}

// ─── Analysis ───────────────────────────────────────────────────────────────

export interface Analysis {
  summary: string;
  strengths: string[];
  risks: string[];
  recommendation: string;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export interface AgentError {
  step: string;
  message: string;
  timestamp: string;
}

// ─── Streaming Events ───────────────────────────────────────────────────────

/** Events pushed to the client over SSE so the UI can show live progress. */
export interface StreamEvent {
  /** Which graph node emitted this event. */
  node: string;

  /** The type of event (e.g. "start", "progress", "complete", "error"). */
  type: "start" | "progress" | "complete" | "error";

  /** Human-readable status message. */
  message: string;

  /** Optional payload (partial data, final report, etc.). */
  data?: unknown;

  /** ISO-8601 timestamp. */
  timestamp: string;
}
