import { NextRequest } from "next/server";

/**
 * POST /api/research
 *
 * Streaming endpoint for the AI Investment Research Agent.
 * Accepts a JSON body with { query: string } and returns a
 * ReadableStream of Server-Sent Events so the frontend can
 * display live progress for each agent step.
 *
 * TODO: Wire up the LangGraph graph and stream node events.
 */
export async function POST(req: NextRequest) {
  const { query } = await req.json();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      // Helper to push an SSE event to the client
      const sendEvent = (data: Record<string, unknown>) => {
        const payload = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };

      try {
        // ── Placeholder: simulate agent steps ───────────────────────────
        sendEvent({
          node: "system",
          type: "start",
          message: `Starting research for: "${query}"`,
          timestamp: new Date().toISOString(),
        });

        // TODO: Replace this placeholder with actual LangGraph execution.
        //       Stream events from graph.streamEvents() or equivalent.

        sendEvent({
          node: "system",
          type: "complete",
          message: "Research pipeline scaffolded — agent logic not yet implemented.",
          data: { query },
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        sendEvent({
          node: "system",
          type: "error",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
