import { ResearchState, TraceEvent, CommitteeVerdict } from "../types";
import { REASONING_MODEL } from "./gemini";
import { CommitteeVerdictSchema, generateValidatedStructuredOutput } from "./validation";

const committeeSchema = {
  type: "object",
  properties: {
    decision: { type: "string", enum: ["invest", "pass", "watch"], description: "The final consensus recommendation from the committee." },
    confidence: { type: "number", description: "Confidence level of the recommendation, from 0.0 (no confidence) to 1.0 (absolute certainty)." },
    reasoning: { type: "string", description: "Comprehensive, fact-grounded explanation synthesizing financials, news, and risks. Must reference specific numbers and facts." },
    keyFactors: {
      type: "array",
      description: "Bullet points detailing the most critical drivers of this verdict.",
      items: { type: "string" }
    }
  },
  required: ["decision", "confidence", "reasoning", "keyFactors"]
};

/**
 * Committee Node: Synthesizes the financials, news, and risk reports into a single, cohesive investment recommendation.
 * Responds to prior critique instructions if present.
 */
export async function committeeNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const companyName = state.companyName;
  const ticker = state.resolvedTicker;
  const displayName = ticker ? `${companyName} (${ticker})` : companyName;
  const timestamp = Date.now();

  const isRevision = state.revisionCount > 0 && state.critique && !state.critique.approved;
  
  const startEvent: TraceEvent = {
    nodeId: "committee",
    status: "started",
    timestamp,
    summary: isRevision 
      ? `Investment Committee revising decision for ${displayName} (Revision #${state.revisionCount})`
      : `Investment Committee meeting to decide verdict for ${displayName}`,
  };

  const fallbackVerdict: CommitteeVerdict = {
    decision: "watch",
    confidence: 0,
    reasoning: "Committee synthesis failed or was aborted due to technical issues.",
    keyFactors: ["Technical failure during evaluation"],
  };

  try {
    console.log(`[Committee Node] Synthesizing reports for ${displayName}...`);

    let prompt = `
You are the Chairperson of an Elite Investment Committee. Your job is to synthesize three distinct analyst reports (Financials, News/Sentiment, and Risks) for ${displayName} into a definitive investment verdict: "invest", "pass", or "watch".

--- REPORT #1: FINANCIALS ---
${JSON.stringify(state.financialsReport || { note: "Not provided" }, null, 2)}

--- REPORT #2: NEWS & SENTIMENT ---
${JSON.stringify(state.newsReport || { note: "Not provided" }, null, 2)}

--- REPORT #3: SKETPICAL RISKS ---
${JSON.stringify(state.riskReport || { note: "Not provided" }, null, 2)}
`;

    if (isRevision && state.critique) {
      prompt += `
\n--- PRIOR CRITIQUE & REVISION INSTRUCTIONS ---
The previous draft verdict was REJECTED by our Critique Partner. 
Concerns raised:
${state.critique.concerns.map(c => `- ${c}`).join("\n")}

Revision Instructions:
${state.critique.revisionInstructions || "Please review the reports and address the above concerns."}

IMPORTANT: You MUST explicitly address these concerns and adjust your reasoning/verdict accordingly in your new response.
`;
    }

    prompt += `
\n--- CRITICAL RULES & INSTRUCTIONS ---
1. DO NOT HALLUCINATE OR INVENT ANY NUMBERS, METRICS, OR FACTS NOT EXPLICITLY PRESENTED IN THE THREE ANALYST REPORTS.
2. If financial data is missing or marked with low/none dataQuality (or if resolvedTicker is null), you MUST:
   - Heavily bias your assessment toward the News/Sentiment and Skeptical Risks reports.
   - Limit your confidence score (maximum confidence of 0.6) to reflect the lack of fundamentals information.
   - Note explicitly in your reasoning that financials were unavailable, and explain how you weighted news and risks.
3. Weigh the identified risks against the financials and positive news.
4. Output your recommendation in structured JSON matching the requested schema.
`;

    // Validate using Zod schemas
    const verdict = await generateValidatedStructuredOutput(
      REASONING_MODEL,
      CommitteeVerdictSchema,
      committeeSchema,
      prompt,
      fallbackVerdict
    );

    console.log(`[Committee Node] Decision: ${verdict.decision.toUpperCase()} with confidence ${verdict.confidence}`);

    const completeEvent: TraceEvent = {
      nodeId: "committee",
      status: "completed",
      timestamp: Date.now(),
      summary: `Committee recommendation: ${verdict.decision.toUpperCase()} (Confidence: ${Math.round(verdict.confidence * 100)}%). ${verdict.keyFactors[0] || ""}`,
      detail: verdict,
    };

    return {
      committeeVerdict: verdict,
      traceEvents: [startEvent, completeEvent],
    };

  } catch (error: any) {
    console.error(`[Committee Node] Error:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "committee",
      status: "error",
      timestamp: Date.now(),
      summary: `Committee failed to reach verdict: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      committeeVerdict: fallbackVerdict,
      traceEvents: [startEvent, errorEvent],
    };
  }
}
