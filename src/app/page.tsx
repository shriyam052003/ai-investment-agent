"use client";

import { useState } from "react";
import { ResearchState, TraceEvent } from "../lib/types";

export default function HomePage() {
  const [companyName, setCompanyName] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [traces, setTraces] = useState<TraceEvent[]>([]);
  const [currentState, setCurrentState] = useState<ResearchState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showRawState, setShowRawState] = useState(false);

  // Clickable example chips
  const examples = ["Tesla", "Zomato", "Reliance Industries", "Apple", "NVIDIA"];

  const handleExampleClick = (name: string) => {
    if (isRunning) return;
    setCompanyName(name);
    startResearch(name);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || isRunning) return;
    startResearch(companyName.trim());
  };

  const startResearch = (targetCompany: string) => {
    setIsRunning(true);
    setTraces([]);
    setCurrentState(null);
    setErrorMsg(null);

    // Use native browser EventSource API to consume GET /api/research endpoint
    const url = `/api/research?companyName=${encodeURIComponent(targetCompany)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);

        if (parsed.type === "error") {
          setErrorMsg(parsed.message);
          setIsRunning(false);
          eventSource.close();
        } else if (parsed.type === "done") {
          const finalData = parsed.data;
          if (finalData?.state) {
            setCurrentState(finalData.state);
          }
          setIsRunning(false);
          eventSource.close();
        } else {
          // Map SSE progress updates into trace events
          const newTrace: TraceEvent = {
            nodeId: parsed.node,
            status: parsed.type === "progress" ? "started" : parsed.type === "complete" ? "completed" : "error",
            timestamp: new Date(parsed.timestamp).getTime(),
            summary: parsed.message,
            detail: parsed.data,
          };
          setTraces((prev) => [...prev, newTrace]);
        }
      } catch (parseErr) {
        console.error("Error parsing EventSource message:", parseErr);
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource encountered connection error:", err);
      setErrorMsg("The research connection closed unexpectedly or encountered an API rate limit error.");
      setIsRunning(false);
      eventSource.close();
    };
  };

  // Helper to get execution status of each node for visual rendering
  const getNodeStatus = (nodeId: string) => {
    const nodeTraces = traces.filter((t) => t.nodeId === nodeId);
    if (nodeTraces.length === 0) return "idle";
    const last = nodeTraces[nodeTraces.length - 1];
    if (last.status === "started") return "running";
    if (last.status === "completed") return "completed";
    if (last.status === "error") return "error";
    return "idle";
  };

  // Helper to determine border/text colors of nodes in the graph
  const getNodeStyle = (status: string) => {
    switch (status) {
      case "running":
        return "border-amber-500 text-amber-400 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse";
      case "completed":
        return "border-emerald-500 text-emerald-400 bg-emerald-500/5";
      case "error":
        return "border-rose-500 text-rose-400 bg-rose-500/10";
      case "idle":
      default:
        return "border-gray-800 text-gray-600 bg-gray-900/10";
    }
  };

  // Helper to determine color classes based on decisions
  const getDecisionColor = (decision: string | undefined) => {
    switch (decision?.toLowerCase()) {
      case "invest":
        return {
          bg: "bg-emerald-950/40 border-emerald-500/30 text-emerald-400",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
          accent: "text-emerald-400",
        };
      case "pass":
        return {
          bg: "bg-rose-950/40 border-rose-500/30 text-rose-400",
          badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
          accent: "text-rose-400",
        };
      case "watch":
      default:
        return {
          bg: "bg-amber-950/40 border-amber-500/30 text-amber-400",
          badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
          accent: "text-amber-400",
        };
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "high":
        return "text-rose-400 bg-rose-500/10 border-rose-500/25";
      case "medium":
        return "text-amber-400 bg-amber-500/10 border-amber-500/25";
      case "low":
      default:
        return "text-emerald-400 bg-emerald-500/10 border-emerald-500/25";
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment.toLowerCase()) {
      case "positive":
        return "text-emerald-400";
      case "negative":
        return "text-rose-400";
      default:
        return "text-gray-400";
    }
  };

  const decisionStyles = getDecisionColor(currentState?.finalVerdict?.decision);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 font-sans p-6 md:p-12 flex flex-col items-center">
      <div className="max-w-6xl w-full space-y-8">
        
        {/* Terminal Header */}
        <div className="border border-gray-800 bg-gray-900/60 rounded-lg p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-xs font-mono uppercase tracking-wider text-gray-400">RESEARCH TERMINAL v1.0</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white font-mono">
              AI INVESTMENT AGENT
            </h1>
            <p className="text-sm text-gray-400">
              LangGraph-orchestrated multi-agent financial consensus engine.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-gray-500 border-l border-gray-800 pl-0 md:pl-6">
            <div>GEMINI: <span className="text-gray-300">Active</span></div>
            <div>•</div>
            <div>TAVILY: <span className="text-gray-300">Active</span></div>
            <div>•</div>
            <div>ALPHA VANTAGE: <span className="text-gray-300">Active</span></div>
          </div>
        </div>

        {/* Input and Controller Panel */}
        <div className="border border-gray-800 bg-gray-900/40 rounded-lg p-6 space-y-4">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                disabled={isRunning}
                placeholder="Enter stock name or ticker (e.g. Reliance, Tesla, AAPL)..."
                className="w-full bg-gray-950 border border-gray-800 rounded px-4 py-3 text-sm focus:outline-none focus:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed font-mono text-white placeholder-gray-600"
              />
            </div>
            <button
              type="submit"
              disabled={isRunning || !companyName.trim()}
              className="bg-gray-100 text-gray-950 hover:bg-white disabled:bg-gray-800 disabled:text-gray-600 font-mono text-sm px-6 py-3 rounded transition-colors font-bold disabled:cursor-not-allowed shrink-0"
            >
              {isRunning ? "RUNNING PIPELINE..." : "RUN RESEARCH"}
            </button>
          </form>

          {/* Preset Tickers */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-gray-500 font-mono">PRESETS:</span>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                disabled={isRunning}
                onClick={() => handleExampleClick(ex)}
                className="px-2.5 py-1 bg-gray-900 border border-gray-800 text-gray-400 hover:text-white hover:border-gray-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors font-mono"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* ERROR MESSAGE DISPLAY */}
        {errorMsg && (
          <div className="border border-rose-900/50 bg-rose-950/20 text-rose-400 rounded-lg p-5 text-sm space-y-1 font-mono">
            <div className="font-bold flex items-center gap-2">
              <span>⚠</span> ERROR ENCOUNTERED
            </div>
            <div>{errorMsg}</div>
          </div>
        )}

        {/* LIVE VISUAL WORKFLOW GRAPH */}
        {(isRunning || traces.length > 0) && (
          <div className="border border-gray-800 bg-gray-900/30 rounded-lg p-6 space-y-6">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-2">
              Live Pipeline Graph
            </h3>
            
            <div className="flex flex-col items-center space-y-4 py-2 select-none">
              
              {/* Row 1: Router */}
              <div className="flex flex-col items-center">
                <div className={`border rounded px-4 py-2 text-xs font-mono text-center min-w-[140px] transition-all duration-300 ${getNodeStyle(getNodeStatus("router"))}`}>
                  <div className="font-bold">1. Router Node</div>
                  <div className="text-[10px] opacity-75 capitalize">Status: {getNodeStatus("router")}</div>
                </div>
                {/* Visual Arrow Down */}
                <div className="w-0.5 h-6 bg-gray-800"></div>
              </div>

              {/* Row 2: Parallel Research (Financials, News, Risk) */}
              <div className="relative w-full max-w-lg">
                {/* Horizontal bridging line */}
                <div className="absolute top-0 left-1/6 right-1/6 h-0.5 bg-gray-800" style={{ left: "15%", right: "15%" }}></div>
                
                <div className="grid grid-cols-3 gap-4 pt-4">
                  {/* Financials Agent */}
                  <div className="flex flex-col items-center relative">
                    <div className="absolute top-0 -mt-4 w-0.5 h-4 bg-gray-800"></div>
                    <div className={`border rounded p-3 text-center w-full transition-all duration-300 ${getNodeStyle(getNodeStatus("financials"))}`}>
                      <div className="text-xs font-mono font-bold">Financials</div>
                      <div className="text-[9px] font-mono opacity-75 capitalize">Status: {getNodeStatus("financials")}</div>
                    </div>
                    <div className="w-0.5 h-6 bg-gray-800"></div>
                  </div>

                  {/* News Agent */}
                  <div className="flex flex-col items-center relative">
                    <div className="absolute top-0 -mt-4 w-0.5 h-4 bg-gray-800"></div>
                    <div className={`border rounded p-3 text-center w-full transition-all duration-300 ${getNodeStyle(getNodeStatus("news"))}`}>
                      <div className="text-xs font-mono font-bold">News</div>
                      <div className="text-[9px] font-mono opacity-75 capitalize">Status: {getNodeStatus("news")}</div>
                    </div>
                    <div className="w-0.5 h-6 bg-gray-800"></div>
                  </div>

                  {/* Risk Agent */}
                  <div className="flex flex-col items-center relative">
                    <div className="absolute top-0 -mt-4 w-0.5 h-4 bg-gray-800"></div>
                    <div className={`border rounded p-3 text-center w-full transition-all duration-300 ${getNodeStyle(getNodeStatus("risk"))}`}>
                      <div className="text-xs font-mono font-bold">Risk Agent</div>
                      <div className="text-[9px] font-mono opacity-75 capitalize">Status: {getNodeStatus("risk")}</div>
                    </div>
                    <div className="w-0.5 h-6 bg-gray-800"></div>
                  </div>
                </div>

                {/* Horizontal bridging line (joining back) */}
                <div className="absolute bottom-0 left-1/6 right-1/6 h-0.5 bg-gray-800" style={{ left: "15%", right: "15%" }}></div>
              </div>

              {/* Row 3: Consensus Committee */}
              <div className="flex flex-col items-center w-full">
                <div className="w-0.5 h-4 bg-gray-800"></div>
                <div className={`border rounded px-4 py-2 text-xs font-mono text-center min-w-[160px] transition-all duration-300 ${getNodeStyle(getNodeStatus("committee"))}`}>
                  <div className="font-bold">3. Committee Consensus</div>
                  <div className="text-[10px] opacity-75 capitalize">Status: {getNodeStatus("committee")}</div>
                </div>
                <div className="w-0.5 h-6 bg-gray-800"></div>
              </div>

              {/* Row 4: Critique Auditor */}
              <div className="flex flex-col items-center relative">
                <div className={`border rounded px-4 py-2 text-xs font-mono text-center min-w-[160px] transition-all duration-300 ${getNodeStyle(getNodeStatus("critiqueAgent"))}`}>
                  <div className="font-bold">4. Critique Partner</div>
                  <div className="text-[10px] opacity-75 capitalize">Status: {getNodeStatus("critiqueAgent")}</div>
                </div>

                {/* Conditional revision loop representation */}
                {currentState && currentState.revisionCount > 0 && (
                  <div className="absolute right-[-100px] top-[-30px] border border-dashed border-blue-500/40 rounded p-1.5 text-[9px] font-mono text-blue-400 bg-blue-500/5 animate-pulse">
                    ↺ Critique loop active
                  </div>
                )}

                <div className="w-0.5 h-6 bg-gray-800"></div>
              </div>

              {/* Row 5: Finalize */}
              <div className="flex flex-col items-center">
                <div className={`border rounded px-4 py-2 text-xs font-mono text-center min-w-[140px] transition-all duration-300 ${getNodeStyle(getNodeStatus("finalize"))}`}>
                  <div className="font-bold">5. Final Verdict (END)</div>
                  <div className="text-[10px] opacity-75 capitalize">Status: {getNodeStatus("finalize")}</div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ACTIVE TIMELINE / PROGRESS TRAIL */}
        {(isRunning || traces.length > 0) && (
          <div className="border border-gray-800 bg-gray-900/20 rounded-lg p-6 space-y-4">
            <h3 className="text-xs font-mono uppercase tracking-wider text-gray-400 border-b border-gray-800 pb-2">
              Agent Execution Trail ({traces.length} steps)
            </h3>
            
            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar font-mono text-xs">
              {traces.map((trace, idx) => {
                const isError = trace.status === "error";
                const isStarted = trace.status === "started";
                return (
                  <div key={idx} className="flex gap-4 items-start animate-fade-in">
                    <span className="text-gray-600 shrink-0 select-none">
                      [{new Date(trace.timestamp).toLocaleTimeString()}]
                    </span>
                    <span className="text-gray-500 uppercase font-bold shrink-0 min-w-[70px]">
                      {trace.nodeId}
                    </span>
                    <span className="text-gray-400 shrink-0">
                      {isStarted ? "→" : isError ? "✗" : "✓"}
                    </span>
                    <span className={`flex-1 ${isError ? "text-rose-400" : isStarted ? "text-gray-400" : "text-gray-300"}`}>
                      {trace.summary}
                    </span>
                  </div>
                );
              })}

              {isRunning && (
                <div className="flex gap-4 items-start text-gray-500 animate-pulse">
                  <span className="select-none">
                    [{new Date().toLocaleTimeString()}]
                  </span>
                  <span className="uppercase font-bold shrink-0 min-w-[70px]">
                    PIPELINE
                  </span>
                  <span className="shrink-0">⟳</span>
                  <span className="flex-1">Awaiting next agent node response...</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* COMPLETED DASHBOARD */}
        {currentState && currentState.finalVerdict && (
          <div className="space-y-6">
            
            {/* 1. Main Committee Verdict */}
            <div className={`border rounded-lg p-6 space-y-4 ${decisionStyles.bg}`}>
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono px-2 py-0.5 rounded border uppercase ${decisionStyles.badge}`}>
                    Verdict Recommendation
                  </span>
                  {currentState.revisionCount > 0 && (
                    <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded uppercase">
                      Revised Verdict
                    </span>
                  )}
                </div>
                <div className="text-sm font-mono">
                  Confidence Score: <span className="font-bold text-white">{(currentState.finalVerdict.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-4xl font-extrabold font-mono tracking-wider text-white">
                  {currentState.finalVerdict.decision.toUpperCase()}
                </div>
                <p className="text-sm leading-relaxed text-gray-200">
                  {currentState.finalVerdict.reasoning}
                </p>
              </div>

              {/* Revision Loop Explanation */}
              {currentState.revisionCount > 0 && currentState.finalVerdict.revisionHistory?.length > 0 && (
                <div className="border border-blue-500/10 bg-blue-950/20 rounded p-4 text-xs font-mono space-y-2">
                  <div className="text-blue-400 font-bold uppercase tracking-wide flex items-center gap-1.5">
                    ℹ COMMITTEE REVISION NOTE
                  </div>
                  {currentState.finalVerdict.revisionHistory.map((history, i) => (
                    <div key={i} className="space-y-1.5 text-gray-300">
                      <div>
                        <strong className="text-white">Previous Verdict:</strong> {history.previousVerdict.decision.toUpperCase()} (Confidence: {(history.previousVerdict.confidence * 100).toFixed(0)}%)
                      </div>
                      <div>
                        <strong className="text-white">Audit Critique:</strong> {history.critique.concerns.join("; ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Key Factors */}
              <div className="space-y-2 pt-2 border-t border-gray-800/40">
                <div className="text-xs font-mono uppercase text-gray-400 tracking-wider">Key Driving Factors:</div>
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {currentState.finalVerdict.keyFactors.map((factor, idx) => (
                    <li key={idx} className="flex gap-2 text-gray-300">
                      <span className={`${decisionStyles.accent} select-none`}>■</span>
                      <span>{factor}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 2. Sub-Agent Reports Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Financials Summary Card */}
              <div className="border border-gray-800 bg-gray-900/30 rounded-lg p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400">Financial Overview</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono uppercase ${
                      currentState.financialsReport?.dataQuality === "high"
                        ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        : currentState.financialsReport?.dataQuality === "none"
                        ? "bg-rose-500/10 text-rose-400 border-rose-500/20"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    }`}>
                      Data: {currentState.financialsReport?.dataQuality || "none"}
                    </span>
                  </div>

                  <p className="text-xs text-gray-300 leading-relaxed">
                    {currentState.financialsReport?.analystSummary}
                  </p>
                </div>

                {currentState.financialsReport?.dataQuality !== "none" && (
                  <div className="border-t border-gray-800/60 pt-3 space-y-2 font-mono text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenue (TTM):</span>
                      <span className="text-white font-bold">
                        {currentState.financialsReport?.revenue ? `$${(currentState.financialsReport.revenue / 1e9).toFixed(2)}B` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Revenue Growth:</span>
                      <span className="text-white font-bold">
                        {currentState.financialsReport?.revenueGrowth ? `${(currentState.financialsReport.revenueGrowth * 100).toFixed(1)}%` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Net Profit Margin:</span>
                      <span className="text-white font-bold">
                        {currentState.financialsReport?.netMargin ? `${(currentState.financialsReport.netMargin * 100).toFixed(1)}%` : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">P/E Ratio:</span>
                      <span className="text-white font-bold">
                        {currentState.financialsReport?.peRatio ? currentState.financialsReport.peRatio.toFixed(1) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Debt to Equity:</span>
                      <span className="text-white font-bold">
                        {currentState.financialsReport?.debtToEquity ? currentState.financialsReport.debtToEquity.toFixed(2) : "N/A"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 border-t border-gray-800/40 pt-2 text-[10px]">
                      <span className="text-gray-500 uppercase shrink-0">FCF Trend:</span>
                      <span className="text-gray-300 truncate text-right">
                        {currentState.financialsReport?.freeCashFlowTrend || "N/A"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* News & Sentiment Card */}
              <div className="border border-gray-800 bg-gray-900/30 rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400">News & Sentiment</h4>
                  <span className="text-[10px] font-mono text-gray-500">TAVILY API</span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  {currentState.newsReport?.overallSentimentSummary}
                </p>

                {currentState.newsReport?.articles && currentState.newsReport.articles.length > 0 && (
                  <div className="space-y-2.5 pt-2 border-t border-gray-800/60 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {currentState.newsReport.articles.map((art, idx) => (
                      <div key={idx} className="text-xs space-y-1">
                        <div className="flex justify-between items-start gap-3">
                          <a
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-gray-200 hover:text-white underline break-words truncate"
                          >
                            {art.headline}
                          </a>
                          <span className={`text-[9px] font-mono shrink-0 uppercase font-bold ${getSentimentColor(art.sentiment)}`}>
                            {art.sentiment}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono">
                          {art.source}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Risks Card */}
              <div className="border border-gray-800 bg-gray-900/30 rounded-lg p-5 space-y-4">
                <div className="flex justify-between items-center border-b border-gray-800 pb-2">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-gray-400">Risk Assessment</h4>
                  <span className="text-[10px] font-mono text-rose-400 uppercase">Skeptical Audit</span>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed">
                  {currentState.riskReport?.overallRiskSummary}
                </p>

                {currentState.riskReport?.risks && currentState.riskReport.risks.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-gray-800/60 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {currentState.riskReport.risks.map((risk, idx) => (
                      <div key={idx} className="text-xs border border-gray-800/50 bg-gray-900/10 p-2.5 rounded space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-gray-200">{risk.flag}</span>
                          <span className={`text-[9px] px-1 py-0.5 rounded font-mono uppercase font-bold border ${getSeverityColor(risk.severity)}`}>
                            {risk.severity}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-400 leading-relaxed">
                          {risk.description}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* 3. Raw Log Toggle */}
            <div className="pt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setShowRawState(!showRawState)}
                className="px-4 py-2 border border-gray-800 bg-gray-900/40 hover:bg-gray-900 hover:text-white rounded text-xs font-mono text-gray-400 transition-all"
              >
                {showRawState ? "HIDE FULL GRAPH STATE" : "VIEW FULL GRAPH STATE"}
              </button>
            </div>

            {showRawState && (
              <div className="border border-gray-800 bg-gray-950 p-6 rounded-lg font-mono text-xs overflow-x-auto max-h-[400px] custom-scrollbar">
                <pre className="text-gray-400">{JSON.stringify(currentState, null, 2)}</pre>
              </div>
            )}

          </div>
        )}

      </div>
    </main>
  );
}
