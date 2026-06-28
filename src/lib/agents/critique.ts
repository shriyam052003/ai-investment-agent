import { ResearchState, TraceEvent, Critique } from "../types";
import { REASONING_MODEL } from "./gemini";
import { CritiqueSchema, generateValidatedStructuredOutput } from "./validation";

const critiqueSchema = {
  type: "object",
  properties: {
    approved: { type: "boolean", description: "Set to true if the verdict is robust and all major risks/financial metrics are addressed; false if revisions are needed." },
    concerns: {
      type: "array",
      description: "List of logical gaps, unaddressed risks, or confirmation biases in the committee's verdict.",
      items: { type: "string" }
    },
    revisionInstructions: { type: "string", description: "Clear instructions detailing what the committee must revise. Null or empty if approved." }
  },
  required: ["approved", "concerns"]
};

/**
 * Critique Node: Acts as a devil's advocate partner. Analyzes the draft CommitteeVerdict
 * against the underlying reports to identify biases, unaddressed risks, or weak logic.
 */
export async function critiqueNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const companyName = state.companyName;
  const ticker = state.resolvedTicker;
  const displayName = ticker ? `${companyName} (${ticker})` : companyName;
  const timestamp = Date.now();

  const startEvent: TraceEvent = {
    nodeId: "critiqueAgent",
    status: "started",
    timestamp,
    summary: `Critique Partner reviewing the Committee's draft verdict for ${displayName}`,
  };

  // On failure, fallback to auto-approve to prevent infinite loops / crashes.
  const fallbackCritique: Critique = {
    approved: true,
    concerns: ["Auto-approved due to critique processing error."],
  };

  try {
    console.log(`[Critique Node] Auditing committee decision for ${displayName}...`);

    const prompt = `
You are a highly analytical, devil's-advocate Investment Partner. Your job is to audit and critique the Investment Committee's draft verdict for ${displayName} against the underlying reports. Do NOT just rubber-stamp the decision.

--- DRAFT COMMITTEE VERDICT ---
${JSON.stringify(state.committeeVerdict || { note: "Missing draft verdict" }, null, 2)}

--- REPORT #1: FINANCIALS ---
${JSON.stringify(state.financialsReport || { note: "Not provided" }, null, 2)}

--- REPORT #2: NEWS & SENTIMENT ---
${JSON.stringify(state.newsReport || { note: "Not provided" }, null, 2)}

--- REPORT #3: RISK ANALYSIS ---
${JSON.stringify(state.riskReport || { note: "Not provided" }, null, 2)}

--- CRITICAL RULES & INSTRUCTIONS ---
1. DO NOT HALLUCINATE OR FABRICATE ANY FACTS OR NUMBERS. Ground all critique directly in what is written in the reports.
2. Auditing Logic: Look for confirmation biases, ignored metrics, or instances where the committee failed to address a severity "high" risk.
3. If the verdict is well-reasoned and logical, set approved: true.
4. If there are gaps (e.g. they decided to invest but overlooked a "high" severity risk, or ignored a major decline in quarterly income), set approved: false, list your concerns, and provide clear revision instructions.

Provide your final output in structured JSON.
`;

    // Validate using Zod schemas
    const critique = await generateValidatedStructuredOutput(
      REASONING_MODEL,
      CritiqueSchema,
      critiqueSchema,
      prompt,
      fallbackCritique
    );

    console.log(`[Critique Node] Audited. Approved: ${critique.approved}. Concerns count: ${critique.concerns.length}`);

    const summaryMsg = critique.approved
      ? `Critique Partner approved the decision.`
      : `Critique Partner rejected the decision: ${critique.concerns[0] || "Needs revision"}`;

    const completeEvent: TraceEvent = {
      nodeId: "critiqueAgent",
      status: "completed",
      timestamp: Date.now(),
      summary: summaryMsg,
      detail: critique,
    };

    return {
      critique,
      traceEvents: [startEvent, completeEvent],
    };

  } catch (error: any) {
    console.error(`[Critique Node] Error:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "critiqueAgent",
      status: "error",
      timestamp: Date.now(),
      summary: `Failed to execute critique: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      critique: fallbackCritique,
      traceEvents: [startEvent, errorEvent],
    };
  }
}
