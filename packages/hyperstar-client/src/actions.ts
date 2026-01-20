/**
 * Hyperstar Client - Action Dispatch
 * Send actions to the server via JSON body
 */
import { collectSignals, mergeSignals } from "./signals";

// Session ID is set during initialization
let sessionId: string | null = null;

/**
 * Set the session ID for action dispatch
 */
export function setSessionId(id: string): void {
  sessionId = id;
}

/**
 * Get the current session ID
 */
export function getSessionId(): string | null {
  return sessionId;
}

/**
 * SSE parser for action responses
 */
async function parseActionResponse(response: Response): Promise<void> {
  if (response.status === 204) {
    // No content - action completed with no patches
    return;
  }

  const contentType = response.headers.get("Content-Type") || "";

  if (contentType.includes("text/event-stream")) {
    // Parse SSE response for patches
    const body = response.body;
    if (!body) return;

    const reader = body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";
    let currentEvent = "";
    let currentData: string[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          const data = line.slice(5);
          currentData.push(data.startsWith(" ") ? data.slice(1) : data);
        } else if (line === "") {
          // End of message
          if (currentData.length > 0) {
            handleSSEMessage(currentEvent, currentData.join("\n"));
          }
          currentEvent = "";
          currentData = [];
        }
      }
    }
  }
}

/**
 * Handle an SSE message from action response
 */
function handleSSEMessage(event: string, data: string): void {
  if (event === "signals") {
    try {
      const parsed = JSON.parse(data);
      // signals event data is the patches directly
      mergeSignals(parsed);
    } catch (e) {
      console.error("[hyperstar] Failed to parse signals:", e);
    }
  }
}

/**
 * Dispatch an action to the server
 * @param actionId The action ID
 * @param args Arguments to pass to the action
 */
export async function dispatch(
  actionId: string,
  args: Record<string, unknown> = {}
): Promise<void> {
  if (!sessionId) {
    console.error("[hyperstar] No session ID set - cannot dispatch action");
    return;
  }

  const signals = collectSignals();

  try {
    const response = await fetch("/hs/action", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "same-origin", // Ensure cookies are sent
      body: JSON.stringify({
        sessionId,
        actionId,
        args,
        signals,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`[hyperstar] Action failed (${response.status}):`, text);
      return;
    }

    await parseActionResponse(response);
  } catch (e) {
    console.error("[hyperstar] Action dispatch error:", e);
  }
}

/**
 * Shorthand for dispatching an action (alias for dispatch)
 */
export function action(actionId: string, args?: Record<string, unknown>): Promise<void> {
  return dispatch(actionId, args);
}

/**
 * Alias for backwards compatibility
 */
export function mutation(actionId: string, args?: Record<string, unknown>): Promise<void> {
  return dispatch(actionId, args);
}

/**
 * Parse a dispatch call from an expression
 * Hyperstar.dispatch('actionId', {args})
 */
export function parseDispatchExpression(expr: string): {
  actionId: string;
  args: string;
} | null {
  const match = expr.match(
    /Hyperstar\.dispatch\s*\(\s*['"]([^'"]+)['"]\s*(?:,\s*(\{[^}]*\}))?\s*\)/
  );

  if (!match) return null;

  return {
    actionId: match[1],
    args: match[2] || "{}",
  };
}
