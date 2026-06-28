import { ResearchState, TraceEvent, NewsReport } from "../types";
import { searchNews } from "../tools/tavily";
import { FAST_MODEL } from "./gemini";
import { NewsReportSchema, generateValidatedStructuredOutput } from "./validation";

const newsSchema = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      description: "List of the most relevant news stories extracted from search results.",
      items: {
        type: "object",
        properties: {
          headline: { type: "string", description: "The title or headline of the news piece." },
          source: { type: "string", description: "The publisher or source name (e.g. Bloomberg, Reuters)." },
          url: { type: "string", description: "The direct URL to the source." },
          sentiment: { type: "string", enum: ["positive", "neutral", "negative"], description: "Sentiment rating of this specific news item." },
          summary: { type: "string", description: "A concise 1-2 sentence summary of what occurred." }
        },
        required: ["headline", "source", "url", "sentiment", "summary"]
      }
    },
    overallSentimentSummary: {
      type: "string",
      description: "A summary combining the overall sentiment, market perception, and recent developments."
    }
  },
  required: ["articles", "overallSentimentSummary"]
};

/**
 * News Agent Node: Searches Tavily for company news and sentiment,
 * then uses Gemini to compile a NewsReport.
 */
export async function newsAgentNode(state: ResearchState): Promise<Partial<ResearchState>> {
  const companyName = state.companyName;
  const ticker = state.resolvedTicker;
  const searchQuery = ticker ? `${companyName} (${ticker})` : companyName;
  const timestamp = Date.now();

  const startEvent: TraceEvent = {
    nodeId: "news",
    status: "started",
    timestamp,
    summary: `Searching recent news & market sentiment for "${searchQuery}"`,
  };

  const fallbackReport: NewsReport = {
    articles: [],
    overallSentimentSummary: "News search failed or yielded no results.",
  };

  try {
    console.log(`[News Node] Running Tavily searches for "${searchQuery}"...`);
    
    // Run two searches in parallel
    const [newsResults, sentimentResults] = await Promise.all([
      searchNews(searchQuery, "recent news and earnings reports"),
      searchNews(searchQuery, "sentiment and market reaction"),
    ]);

    const combinedResults = [...newsResults, ...sentimentResults];
    
    if (combinedResults.length === 0) {
      console.warn(`[News Node] No search results returned for "${searchQuery}".`);
      const completeEvent: TraceEvent = {
        nodeId: "news",
        status: "completed",
        timestamp: Date.now(),
        summary: "No news articles found in search results.",
        detail: fallbackReport,
      };
      return {
        newsReport: fallbackReport,
        traceEvents: [startEvent, completeEvent],
      };
    }

    console.log(`[News Node] Analyzing ${combinedResults.length} search results with Gemini...`);

    const prompt = `
You are a sentiment and news analyst. Analyze the following web search results for "${searchQuery}" and generate a structured NewsReport.

--- WEB SEARCH RESULTS ---
${JSON.stringify(combinedResults, null, 2)}

--- CRITICAL RULES & INSTRUCTIONS ---
1. DO NOT HALLUCINATE OR INVENT HEADLINES, SOURCES, OR SENTIMENT.
2. If there are no search results or the results are irrelevant, return an empty array for articles and explain in the overallSentimentSummary that "no news results were available for the company".
3. Extract the most important/relevant news articles (max 6 articles).
4. Assign an accurate sentiment ("positive", "neutral", "negative") to each article.
5. Draft a cohesive overall sentiment summary describing current market perception, key announcements, or earnings sentiment.

Provide your final output in structured JSON.
`;

    // Validate using Zod schemas
    const report = await generateValidatedStructuredOutput(
      FAST_MODEL,
      NewsReportSchema,
      newsSchema,
      prompt,
      fallbackReport
    );

    const completeEvent: TraceEvent = {
      nodeId: "news",
      status: "completed",
      timestamp: Date.now(),
      summary: report.overallSentimentSummary,
      detail: report,
    };

    return {
      newsReport: report,
      traceEvents: [startEvent, completeEvent],
    };

  } catch (error: any) {
    console.error(`[News Node] Error:`, error);
    
    const errorEvent: TraceEvent = {
      nodeId: "news",
      status: "error",
      timestamp: Date.now(),
      summary: `Failed to compile news report: ${error.message || "Unknown error"}`,
      detail: error,
    };

    return {
      newsReport: fallbackReport,
      traceEvents: [startEvent, errorEvent],
    };
  }
}
