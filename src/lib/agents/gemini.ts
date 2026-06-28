import { GoogleGenerativeAI } from "@google/generative-ai";

// ============================================================================
// MODEL CONFIGURATION CONSTANTS
// Change these constants to swap the Gemini models used in the agents.
// ============================================================================

/** Faster and cheaper model used for the research sub-agents (financials, news, risk). */
export const FAST_MODEL = "gemini-2.5-flash";

/** Strongest reasoning model used for the Committee and Critique nodes. */
export const REASONING_MODEL = "gemini-2.5-flash";

// ============================================================================

let genAIInstance: GoogleGenerativeAI | null = null;

/**
 * Lazy initializer for GoogleGenerativeAI client.
 */
export function getGenAI(): GoogleGenerativeAI {
  if (!genAIInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is not set.");
    }
    genAIInstance = new GoogleGenerativeAI(apiKey);
  }
  return genAIInstance;
}

/**
 * Returns a configured model instance.
 *
 * @param modelName - The model identifier (e.g. FAST_MODEL or REASONING_MODEL)
 * @param responseSchema - Optional JSON schema for structured JSON output
 */
export function getGeminiModel(modelName: string, responseSchema?: any) {
  const genAI = getGenAI();
  
  const generationConfig: any = {};
  if (responseSchema) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseSchema = responseSchema;
  }

  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig,
  });
}
