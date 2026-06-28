import { z } from "zod";
import { getGeminiModel } from "./gemini";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

export const FinancialsReportSchema = z.object({
  revenue: z.number().nullable(),
  revenueGrowth: z.number().nullable(),
  netMargin: z.number().nullable(),
  peRatio: z.number().nullable(),
  debtToEquity: z.number().nullable(),
  freeCashFlowTrend: z.string().nullable(),
  analystSummary: z.string(),
  dataQuality: z.enum(["high", "medium", "low", "none"]),
});

export const NewsItemSchema = z.object({
  headline: z.string(),
  source: z.string(),
  url: z.string(),
  sentiment: z.enum(["positive", "neutral", "negative"]),
  summary: z.string(),
});

export const NewsReportSchema = z.object({
  articles: z.array(NewsItemSchema),
  overallSentimentSummary: z.string(),
});

export const RiskItemSchema = z.object({
  flag: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
});

export const RiskReportSchema = z.object({
  risks: z.array(RiskItemSchema),
  overallRiskSummary: z.string(),
});

export const CommitteeVerdictSchema = z.object({
  decision: z.enum(["invest", "pass", "watch"]),
  confidence: z.number(),
  reasoning: z.string(),
  keyFactors: z.array(z.string()),
});

export const CritiqueSchema = z.object({
  approved: z.boolean(),
  concerns: z.array(z.string()),
  revisionInstructions: z.string().optional(),
});

// ─── Gemini Rate-Limit Resilient Content Generator ───────────────────────────

/**
 * Calls Gemini model.generateContent, catching any 429 Rate Limit/Quota Exceeded errors
 * and retrying with exponential backoff.
 */
async function generateContentWithRateLimitRetry(
  model: any,
  prompt: string,
  retriesLeft = 3,
  delayMs = 2500
): Promise<any> {
  try {
    return await model.generateContent(prompt);
  } catch (error: any) {
    const errorStr = String(error?.message || "");
    const isRateLimit = 
      errorStr.includes("429") || 
      errorStr.includes("Quota") || 
      errorStr.includes("rate limit") || 
      errorStr.includes("Too Many Requests");

    if (isRateLimit && retriesLeft > 0) {
      console.warn(`[Gemini Rate Limiter] Got 429 / Quota Exceeded. Retrying in ${delayMs}ms... (Retries left: ${retriesLeft})`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return generateContentWithRateLimitRetry(model, prompt, retriesLeft - 1, delayMs * 2);
    }
    throw error;
  }
}

// ─── Execution Helper with Correction Retry ──────────────────────────────────

/**
 * Executes a Gemini content generation call and parses the result into a validated JSON object.
 * If parsing or schema validation fails, it retries once appending corrective feedback.
 * If the retry also fails, it returns the provided fallback value.
 *
 * All LLM requests are wrapped in a rate-limiting backoff handler to handle 429 errors.
 */
export async function generateValidatedStructuredOutput<T>(
  modelName: string,
  zodSchema: z.ZodSchema<T>,
  geminiSchema: any,
  prompt: string,
  fallback: T
): Promise<T> {
  const model = getGeminiModel(modelName, geminiSchema);

  try {
    const aiRes = await generateContentWithRateLimitRetry(model, prompt);
    const text = aiRes.response.text().trim();
    const parsed = JSON.parse(text);
    return zodSchema.parse(parsed);
  } catch (err: any) {
    console.warn(`[Validation Helper] First generation failed or failed validation: ${err.message}. Retrying with feedback...`);

    try {
      const correctivePrompt = `
${prompt}

--- CORRECTIVE FEEDBACK ---
Your previous response was invalid. It failed parsing or validation with this error:
"${err.message}"

Please try again. Ensure your output strictly complies with the requested JSON schema:
${JSON.stringify(geminiSchema, null, 2)}

Provide your corrected JSON response:
`;
      const aiResRetry = await generateContentWithRateLimitRetry(model, correctivePrompt);
      const textRetry = aiResRetry.response.text().trim();
      const parsedRetry = JSON.parse(textRetry);
      return zodSchema.parse(parsedRetry);
    } catch (retryErr: any) {
      console.error(`[Validation Helper] Retry failed validation: ${retryErr.message}. Returning fallback object.`);
      return fallback;
    }
  }
}
