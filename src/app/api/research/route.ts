import { NextRequest } from "next/server";
import { investmentGraph } from "../../../lib/graph";
import { TraceEvent } from "../../../lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Handles the core streaming logic for the Investment Research Agent.
 */
async function runResearchStream(companyName: string, controller: ReadableStreamDefaultController, encoder: TextEncoder) {
  const sendEvent = (data: Record<string, unknown>) => {
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    controller.enqueue(encoder.encode(payload));
  };

  // Set up a 120-second abort timeout
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => {
    abortController.abort(new Error("Timeout: The research run took longer than 120 seconds."));
  }, 120000);

  try {
    console.log(`[API Route] Starting LangGraph stream for "${companyName}"...`);
    
    // Initial state payload
    sendEvent({
      node: "system",
      type: "start",
      message: `Starting research for: "${companyName}"`,
      timestamp: new Date().toISOString(),
    });

    // Initialize state tracker
    let accumulatedState: any = {
      companyName: companyName.trim(),
      revisionCount: 0,
      traceEvents: [],
    };

    // Stream the LangGraph execution with streamMode: "updates"
    const stream = await investmentGraph.stream(
      accumulatedState,
      {
        signal: abortController.signal,
        streamMode: "updates",
      }
    );

    for await (const chunk of stream) {
      for (const [nodeName, update] of Object.entries(chunk)) {
        // Accumulate changes in our local state object
        accumulatedState = {
          ...accumulatedState,
          ...update,
          // Concatenate array traceEvents according to the state reducer rules
          traceEvents: accumulatedState.traceEvents.concat((update as any).traceEvents || []),
        };

        // Stream any trace events emitted by this node immediately
        const nodeEvents: TraceEvent[] = (update as any).traceEvents || [];
        for (const event of nodeEvents) {
          sendEvent({
            node: event.nodeId,
            type: event.status === "started" ? "progress" : event.status === "completed" ? "complete" : "error",
            message: event.summary,
            data: event.detail,
            timestamp: new Date(event.timestamp).toISOString(),
          });
        }
      }
    }

    // Send final completion event with the complete state and final verdict
    sendEvent({
      node: "system",
      type: "done",
      message: "Research completed successfully.",
      data: {
        finalVerdict: accumulatedState.finalVerdict,
        state: accumulatedState,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error: any) {
    console.error("[API Route] Error while running investmentGraph:", error);
    
    const message = error?.message || "An unexpected error occurred during research.";
    sendEvent({
      node: "system",
      type: "error",
      message,
      timestamp: new Date().toISOString(),
    });
  } finally {
    clearTimeout(timeoutId);
    controller.close();
  }
}

/**
 * GET /api/research
 * Allows native browser EventSource connections by reading query parameters.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const companyName = searchParams.get("companyName");

  if (!companyName || companyName.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "companyName query parameter is required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (companyName.length > 100) {
    return new Response(
      JSON.stringify({ error: "companyName is too long (maximum 100 characters)" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    start(controller) {
      runResearchStream(companyName, controller, encoder);
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

/**
 * POST /api/research
 * Legacy endpoint to accept POST with JSON body.
 */
export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { companyName } = body;

  if (!companyName || typeof companyName !== "string" || companyName.trim().length === 0) {
    return new Response(
      JSON.stringify({ error: "companyName is required and must be a non-empty string" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  if (companyName.length > 100) {
    return new Response(
      JSON.stringify({ error: "companyName is too long (maximum 100 characters)" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const encoder = new TextEncoder();
  const responseStream = new ReadableStream({
    start(controller) {
      runResearchStream(companyName, controller, encoder);
    },
  });

  return new Response(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
