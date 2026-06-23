/**
 * LangGraph graph definition for the AI Investment Research Agent.
 *
 * This file will define the StateGraph, wire up nodes from /lib/agents,
 * and export a compiled, runnable graph.
 *
 * TODO: Implement the graph with the following flow:
 *  1. queryParser  → decides which research paths to take
 *  2. webResearcher + financialData  → run in parallel
 *  3. analyst      → synthesize all collected data
 *  4. reportWriter → produce the final user-facing report
 */

export {};
