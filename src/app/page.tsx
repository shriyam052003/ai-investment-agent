/**
 * AI Investment Research Agent — Main Page
 *
 * This is the primary UI for submitting research queries and
 * viewing live streaming results from the agent pipeline.
 *
 * TODO: Implement the full UI with:
 *  - A search input for stock ticker / research query
 *  - A live progress panel showing each agent step
 *  - A rendered markdown report panel
 */

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Header */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Scaffolding Complete
          </div>
          <h1 className="text-5xl font-bold tracking-tight text-white">
            AI Investment
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              {" "}Research Agent
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-md mx-auto">
            Powered by LangGraph, Gemini, Tavily, and Alpha Vantage.
            Enter a stock ticker to get an AI-generated research report.
          </p>
        </div>

        {/* Placeholder Input */}
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-600 to-cyan-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
          <div className="relative flex items-center bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-xl px-5 py-4">
            <svg className="w-5 h-5 text-gray-500 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              disabled
              placeholder="e.g. &quot;Analyze AAPL for long-term investment&quot;"
              className="bg-transparent text-white placeholder-gray-500 outline-none w-full text-lg disabled:cursor-not-allowed"
            />
            <button
              disabled
              className="ml-3 px-5 py-2 bg-emerald-600/50 text-emerald-300 rounded-lg text-sm font-semibold cursor-not-allowed opacity-60"
            >
              Research
            </button>
          </div>
        </div>

        {/* Status */}
        <p className="text-gray-600 text-sm">
          Agent logic not yet implemented — this is the project scaffold.
        </p>
      </div>
    </main>
  );
}
