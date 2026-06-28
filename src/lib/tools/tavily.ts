/**
 * Tavily API tool wrapper for web search.
 */

export interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  publishedDate?: string;
}

/**
 * Searches news articles/web results for a company with a specific research focus.
 * Handles network failures with a retry and falls back to an empty array upon failure.
 *
 * @param companyName - The name of the company to search.
 * @param focus - The research bias/focus (e.g. "recent news and earnings", "controversies lawsuits").
 * @returns Array of Tavily search results.
 */
export async function searchNews(
  companyName: string,
  focus: string
): Promise<TavilySearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("Tavily API wrapper: TAVILY_API_KEY is not defined in environment variables.");
    return [];
  }

  const query = `${companyName} ${focus}`.trim();
  const url = "https://api.tavily.com/search";

  const fetchWithRetry = async (retriesLeft: number): Promise<Response> => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: query,
          search_depth: "advanced",
          include_answer: false,
        }),
      });
      return response;
    } catch (error) {
      if (retriesLeft > 0) {
        console.warn(`Tavily search network failure. Retrying... (${retriesLeft} retry left)`);
        // Simple delay before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchWithRetry(retriesLeft - 1);
      }
      throw error;
    }
  };

  try {
    const response = await fetchWithRetry(1);
    if (!response.ok) {
      console.warn(`Tavily search failed with status ${response.status}: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    if (!data || !Array.isArray(data.results)) {
      console.warn("Tavily API response did not contain results array:", data);
      return [];
    }

    return data.results.map((result: any) => ({
      title: result.title || "",
      url: result.url || "",
      content: result.content || "",
      score: typeof result.score === "number" ? result.score : 0,
      publishedDate: result.published_date || undefined,
    }));
  } catch (error) {
    console.warn(`Tavily search wrapper failed gracefully for query "${query}":`, error);
    return [];
  }
}
