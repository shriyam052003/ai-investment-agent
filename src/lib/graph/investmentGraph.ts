import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { ResearchState, FinancialsReport, NewsReport, RiskReport, CommitteeVerdict, Critique, FinalVerdict, TraceEvent } from "../types";
import { routerNode, financialsAgentNode, newsAgentNode, riskAgentNode, committeeNode, critiqueNode } from "../agents";

// Define the root state schema for LangGraph.js
export const ResearchStateAnnotation = Annotation.Root({
  /** Raw company name input. */
  companyName: Annotation<string>(),

  /** Resolved stock ticker symbol (or null). */
  resolvedTicker: Annotation<string | null>(),

  /** Sector and exchange details. */
  companyContext: Annotation<{ sector?: string; exchange?: string }>(),

  /** Financial summary report. */
  financialsReport: Annotation<FinancialsReport | null>(),

  /** News and sentiment report. */
  newsReport: Annotation<NewsReport | null>(),

  /** Skeptical risk report. */
  riskReport: Annotation<RiskReport | null>(),

  /** Current committee recommendation verdict. */
  committeeVerdict: Annotation<CommitteeVerdict | null>(),

  /** Audit critique. */
  critique: Annotation<Critique | null>(),

  /** Number of revision loops performed (cap of 1). */
  revisionCount: Annotation<number>(),

  /** Final consensus verdict including revision history. */
  finalVerdict: Annotation<FinalVerdict | null>(),

  /** Append-only list of node trace events for UI. */
  traceEvents: Annotation<TraceEvent[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

/**
 * Increment Revision Node: Increments the revision counter by 1
 * when the critique partner requests a revision.
 */
async function incrementRevisionNode(state: typeof ResearchStateAnnotation.State): Promise<Partial<ResearchState>> {
  const nextRevision = (state.revisionCount || 0) + 1;
  return {
    revisionCount: nextRevision,
    traceEvents: [{
      nodeId: "critiqueAgent",
      status: "completed",
      timestamp: Date.now(),
      summary: `Revision count updated to ${nextRevision}. Directing Committee to re-evaluate.`,
    }],
  };
}

/**
 * Finalize Node: Prepares the FinalVerdict object, reconstructing the revision
 * history from trace logs if critique loop(s) took place, and ends the workflow.
 */
async function finalizeNode(state: typeof ResearchStateAnnotation.State): Promise<Partial<ResearchState>> {
  const timestamp = Date.now();
  const startEvent: TraceEvent = {
    nodeId: "finalize",
    status: "started",
    timestamp,
    summary: "Consolidating final investment report...",
  };

  // Reconstruct revision history from the trace logs
  const revisionHistory: any[] = [];
  const committeeEvents = state.traceEvents.filter(e => e.nodeId === "committee" && e.status === "completed");
  const critiqueEvents = state.traceEvents.filter(e => e.nodeId === "critiqueAgent" && e.status === "completed");

  const revisions = state.revisionCount || 0;
  for (let i = 0; i < revisions; i++) {
    if (committeeEvents[i] && critiqueEvents[i]) {
      revisionHistory.push({
        revisionNumber: i + 1,
        previousVerdict: committeeEvents[i].detail as CommitteeVerdict,
        critique: critiqueEvents[i].detail as Critique,
      });
    }
  }

  const finalVerdict: FinalVerdict = {
    ...state.committeeVerdict!,
    revisionHistory,
  };

  const completeEvent: TraceEvent = {
    nodeId: "finalize",
    status: "completed",
    timestamp: Date.now(),
    summary: `Analysis finalized: recommendation is ${finalVerdict.decision.toUpperCase()}`,
    detail: finalVerdict,
  };

  return {
    finalVerdict,
    traceEvents: [startEvent, completeEvent],
  };
}

/**
 * Conditional Edge: Decides whether to send the workflow to finalization or loop back
 * to the investment committee to address the critique's concerns.
 */
function routeCritiqueDecision(state: typeof ResearchStateAnnotation.State) {
  const isApproved = state.critique?.approved ?? true;
  const currentRevisions = state.revisionCount || 0;

  console.log(`[Graph Routing] Critique Approved: ${isApproved}. Current revisions: ${currentRevisions}`);

  // Loop back if the critique rejected the draft verdict AND we haven't hit the 1-revision hard limit.
  if (!isApproved && currentRevisions < 1) {
    console.log("[Graph Routing] Directing back to committee for revision...");
    return "incrementRevision";
  }

  // Otherwise, finalize the workflow (either approved or hit revision cap)
  console.log("[Graph Routing] Finalizing workflow...");
  return "finalize";
}

// Build and wire up the LangGraph StateGraph
const workflow = new StateGraph(ResearchStateAnnotation)
  // 1. Register nodes
  .addNode("router", routerNode)
  .addNode("financials", financialsAgentNode)
  .addNode("news", newsAgentNode)
  .addNode("risk", riskAgentNode)
  .addNode("committee", committeeNode)
  .addNode("critiqueAgent", critiqueNode)
  .addNode("incrementRevision", incrementRevisionNode)
  .addNode("finalize", finalizeNode)

  // 2. Wire edges
  .addEdge(START, "router")
  
  // Parallel Fan-Out: Router branches out to Financials, News, and Risk in parallel.
  // In LangGraph.js, multiple edges from a single node cause concurrent node execution.
  .addEdge("router", "financials")
  .addEdge("router", "news")
  .addEdge("router", "risk")

  // Parallel Fan-In (Join): Committee executes only after all three parallel nodes complete.
  .addEdge("financials", "committee")
  .addEdge("news", "committee")
  .addEdge("risk", "committee")

  // Linear flow from Committee to Critique
  .addEdge("committee", "critiqueAgent")

  // Conditional branching from Critique based on approval or revision cap
  .addConditionalEdges("critiqueAgent", routeCritiqueDecision, {
    incrementRevision: "incrementRevision",
    finalize: "finalize",
  })

  // Loop back to committee after incrementing the revision counter
  .addEdge("incrementRevision", "committee")

  // Finalize leads to the end of the workflow
  .addEdge("finalize", END);

// Compile the executable graph
export const investmentGraph = workflow.compile();
