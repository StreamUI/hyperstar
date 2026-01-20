/**
 * Hyperstar Client - SSE Connection
 * Server-Sent Events connection with automatic reconnection
 */
import { mergeSignals } from "./signals";
import { morph } from "./morph";
import { processTree, clearProcessedState } from "./process";

// Event types from server (must match SSE event types in hyperstar server)
const EVENT_MORPH = "morph";
const EVENT_SIGNALS = "signals";
const EVENT_EXECUTE = "execute";
const EVENT_REDIRECT = "redirect";
const EVENT_ERROR = "error";
const EVENT_TITLE = "title";
const EVENT_FAVICON = "favicon";

// Connection state
let controller: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let lastEventId: string | null = null;
let currentUrl: string | null = null;
let visibilityHandler: (() => void) | null = null;
let isPaused = false;

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

/**
 * Parse an SSE message from the text format
 */
interface SSEMessage {
  event: string;
  data: string;
  id?: string;
  retry?: number;
}

function parseSSEMessage(lines: string[]): SSEMessage | null {
  let event = "message";
  let data = "";
  let id: string | undefined;
  let retry: number | undefined;

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      const value = line.slice(5);
      // Handle space after colon
      data += (value.startsWith(" ") ? value.slice(1) : value) + "\n";
    } else if (line.startsWith("id:")) {
      id = line.slice(3).trim();
    } else if (line.startsWith("retry:")) {
      retry = parseInt(line.slice(6).trim(), 10);
    }
  }

  // Trim trailing newline from data
  if (data.endsWith("\n")) {
    data = data.slice(0, -1);
  }

  if (!data && event === "message") {
    return null;
  }

  return { event, data, id, retry };
}

/**
 * Process incoming SSE events
 */
async function processBytes(
  stream: ReadableStream<Uint8Array>,
  onMessage: (msg: SSEMessage) => void
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let messageLines: string[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Process complete lines
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line === "") {
        // Empty line = end of message
        if (messageLines.length > 0) {
          const msg = parseSSEMessage(messageLines);
          if (msg) {
            onMessage(msg);
          }
          messageLines = [];
        }
      } else {
        messageLines.push(line);
      }
    }
  }
}

/**
 * Handle an incoming SSE message
 */
function handleMessage(msg: SSEMessage): void {
  // Track last event ID for resume support
  if (msg.id) {
    lastEventId = msg.id;
  }

  // Skip processing when paused (tab hidden) to save CPU
  // We still track the event ID above for resume support
  if (isPaused) {
    return;
  }

  switch (msg.event) {
    case EVENT_MORPH: {
      try {
        const data = JSON.parse(msg.data);
        if (data.html) {
          morphDOM(data.html, data.target);
        }
      } catch (e) {
        console.error("[hyperstar] Failed to parse morph message:", e);
      }
      break;
    }

    case EVENT_SIGNALS: {
      try {
        const data = JSON.parse(msg.data);
        // signals event data is the patches directly
        mergeSignals(data);
      } catch (e) {
        console.error("[hyperstar] Failed to parse signals message:", e);
      }
      break;
    }

    case EVENT_EXECUTE: {
      try {
        const data = JSON.parse(msg.data);
        if (data.script) {
          executeScript(data.script);
        }
      } catch (e) {
        console.error("[hyperstar] Failed to parse execute message:", e);
      }
      break;
    }

    case EVENT_REDIRECT: {
      try {
        const data = JSON.parse(msg.data);
        if (data.url) {
          if (data.replace) {
            window.location.replace(data.url);
          } else {
            window.location.href = data.url;
          }
        }
      } catch (e) {
        console.error("[hyperstar] Failed to parse redirect message:", e);
      }
      break;
    }

    case EVENT_ERROR: {
      try {
        const data = JSON.parse(msg.data);
        console.error("[hyperstar] Server error:", data.message, data.code);
      } catch (e) {
        console.error("[hyperstar] Failed to parse error message:", e);
      }
      break;
    }

    case EVENT_TITLE: {
      try {
        const data = JSON.parse(msg.data);
        if (data.title) {
          document.title = data.title;
        }
      } catch (e) {
        console.error("[hyperstar] Failed to parse title message:", e);
      }
      break;
    }

    case EVENT_FAVICON: {
      try {
        const data = JSON.parse(msg.data);
        if (data.href) {
          updateFavicon(data.href, data.type);
        }
      } catch (e) {
        console.error("[hyperstar] Failed to parse favicon message:", e);
      }
      break;
    }

    default:
      // Ignore unknown events (task:progress, task:complete, etc.)
      break;
  }
}

/**
 * Morph DOM with new HTML
 */
function morphDOM(html: string, targetId?: string): void {
  // If a target ID is specified, morph that element directly
  if (targetId) {
    const targetEl = document.getElementById(targetId);
    if (targetEl) {
      // Parse the HTML
      const template = document.createElement("template");
      template.innerHTML = html;
      const newContent = template.content.firstElementChild;
      if (newContent) {
        morph(targetEl, newContent);
        clearProcessedState(targetEl);
        processTree(targetEl);
      }
      return;
    }
  }

  // Parse the HTML
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;

  // Find elements to morph by ID
  for (const child of Array.from(fragment.children)) {
    const id = child.id;
    if (id) {
      const target = document.getElementById(id);
      if (target) {
        morph(target, child as Element);
        // Clear processed state and reprocess the morphed subtree
        clearProcessedState(target);
        processTree(target);
      }
    } else {
      // For elements without ID, morph into body
      morph(document.body, child as Element, "inner");
      clearProcessedState(document.body);
      processTree(document.body);
    }
  }
}

/**
 * Update the page favicon
 */
function updateFavicon(href: string, type: string = "image/x-icon"): void {
  let link = document.querySelector("link[rel='icon']") as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = href;
  link.type = type;
}

/**
 * Execute a script from the server
 */
function executeScript(code: string): void {
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function(code);
    fn();
  } catch (e) {
    console.error("[hyperstar] Script execution error:", e);
  }
}

/**
 * Calculate reconnect delay with exponential backoff
 */
function getReconnectDelay(): number {
  const delay = Math.min(
    BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
    MAX_RECONNECT_DELAY
  );
  return delay + Math.random() * 1000; // Add jitter
}

// Track if we're currently connecting
let isConnecting = false;

/**
 * Set up visibility change handler to pause SSE when tab is hidden
 * Optimization: Saves bandwidth/CPU when tab is not visible
 */
function setupVisibilityHandler(url: string): void {
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
  }

  visibilityHandler = () => {
    if (document.hidden) {
      // Tab is hidden - pause processing (connection stays open)
      isPaused = true;
    } else {
      // Tab is visible again
      isPaused = false;
      // If connection was lost while hidden, reconnect
      if (!isConnected() && !isConnecting) {
        connect(url);
      }
    }
  };

  document.addEventListener("visibilitychange", visibilityHandler);
}

/**
 * Connect to SSE endpoint
 */
export async function connect(url = "/sse"): Promise<void> {
  // Prevent duplicate connection attempts
  if (isConnecting || (controller && !controller.signal.aborted)) {
    return;
  }

  // Store URL for reconnection and visibility handler
  currentUrl = url;

  // Disconnect existing connection
  disconnect();

  // Set up visibility handler for this connection
  setupVisibilityHandler(url);

  isConnecting = true;
  controller = new AbortController();

  try {
    // Build headers with optional Last-Event-ID for resume support
    const headers: Record<string, string> = {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    };

    if (lastEventId) {
      headers["Last-Event-ID"] = lastEventId;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      signal: controller.signal,
      credentials: "same-origin", // Ensure cookies are sent
    });

    if (!response.ok) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    if (!response.body) {
      throw new Error("SSE response has no body");
    }

    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;
    isConnecting = false;

    // Process the stream
    await processBytes(response.body, handleMessage);

    // Stream ended normally, try to reconnect
    scheduleReconnect(url);
  } catch (e) {
    isConnecting = false;

    // Handle abort (can be AbortError or TypeError depending on browser)
    const err = e as Error;
    if (
      err.name === "AbortError" ||
      err.message?.includes("abort") ||
      err.message?.includes("network error")
    ) {
      // Network errors during page load are normal, reconnect will handle it
      scheduleReconnect(url);
      return;
    }

    console.error("[hyperstar] SSE connection error:", e);
    scheduleReconnect(url);
  }
}

/**
 * Schedule a reconnection attempt
 */
function scheduleReconnect(url: string): void {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error("[hyperstar] Max reconnect attempts reached");
    return;
  }

  reconnectAttempts++;
  const delay = getReconnectDelay();

  reconnectTimer = setTimeout(() => {
    connect(url);
  }, delay);
}

/**
 * Disconnect from SSE
 */
export function disconnect(): void {
  isConnecting = false;
  isPaused = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (controller) {
    controller.abort();
    controller = null;
  }

  // Clean up visibility handler
  if (visibilityHandler) {
    document.removeEventListener("visibilitychange", visibilityHandler);
    visibilityHandler = null;
  }
}

/**
 * Check if connected
 */
export function isConnected(): boolean {
  return controller !== null && !controller.signal.aborted;
}
