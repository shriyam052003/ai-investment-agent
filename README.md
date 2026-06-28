# AI Investment Research Agent

> Full-stack AI-powered investment research tool built with Next.js, LangGraph, and Gemini.

This system orchestrates a multi-agent consensus network (Fundamentals, News Sentiment, and Skeptical Risks) to produce high-integrity investment recommendations.

## Quick Start

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment**:
   Copy `.env.local.example` to `.env.local` and paste your actual API keys:
   ```bash
   GEMINI_API_KEY=your_key
   TAVILY_API_KEY=your_key
   ALPHA_VANTAGE_API_KEY=your_key
   ```

3. **Run the server**:
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` to access the terminal interface.

---

## Technical Edge Cases Handled

The agents are specifically designed to address common reliability risks associated with live financial research:

### 1. Unresolved Company Names (Private Entities / Typos)
* **What happens**: The `Router` node fails to map the company query to a stock ticker.
* **Graceful Handling**: Instead of failing, the `Financials` agent automatically skips Alpha Vantage lookup and returns a degraded financial report (`dataQuality: "none"`). The `Committee` consensus node detects this, shifts its analytical weight entirely to the news and risk reports, and caps the verdict's confidence score (max `0.6`) to reflect the lack of fundamentals data.

### 2. Alpha Vantage Free-Tier Rate Limits
* **What happens**: Alpha Vantage free-tier imposes a strict limit of 5 requests per minute and 500 per day.
* **Graceful Handling**: 
  1. A serialized queuing delay (**12 seconds**) is enforced between consecutive API calls to prevent rate limit hits.
  2. If rate limits are still triggered (e.g. from concurrent usage), the tool wrapper intercepts the API's `"Note"` response, returns a typed fallback with `dataQuality: "none"`, and prevents node execution crashes.

### 3. Obscure Companies (Zero Search Results)
* **What happens**: The company is so obscure that Tavily news searches yield zero results.
* **Graceful Handling**: Sub-agents are explicitly instructed via system prompts not to invent news headlines, controversies, or sources. If results are empty, they honestly report `"no news results available"` or `"no legal risks detected"`, rather than hallucinating details.

### 4. LLM Metric Fabrication Prevention
* **What happens**: LLMs tend to guess specific metrics (e.g., net margin, P/E ratio) when data is missing.
* **Graceful Handling**: System prompts explicitly forbid inventing numbers. If a financial metric is missing, agents set the value to `null` and state `"data not available"` in their summaries.

### 5. Structured JSON Output Validation (Zod + Corrective Retry)
* **What happens**: Gemini's JSON mode occasionally outputs malformed JSON or omits required fields.
* **Graceful Handling**: 
  * Every LLM response is validated against Zod schemas matching the definitions in `types.ts`.
  * **Corrective Retry**: If validation fails, the agent makes a second corrective call to Gemini, feeding back the exact validation error message for self-correction.
  * **Safe Fallback**: If the self-correction also fails, the agent outputs a safe, degraded report object to keep the graph moving.
