import { generateStandardDraft } from "@/app/actions/standard-draft";
import { runAiTask } from "@/lib/ai/task-context";
import { getCurrentWorkspace } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  // Cookie-authenticated mutations must be same-origin.
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  if (Number(request.headers.get("content-length") || 0) > 16000) return Response.json({ error: "Instructions are too long." }, { status: 413 });
  const workspace = await getCurrentWorkspace();
  if (!workspace) return Response.json({ error: "Please sign in again." }, { status: 401 });
  let input: unknown;
  try { input = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const abort = new AbortController();
  const signal = AbortSignal.any([request.signal, abort.signal, AbortSignal.timeout(295000)]);
  const encoder = new TextEncoder();
  let closed = false;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: unknown) => { if (!closed && !signal.aborted) controller.enqueue(encoder.encode(JSON.stringify(event) + "\n")); };
      // Keep proxies from buffering/closing an idle stream during a long inference.
      const heartbeat = setInterval(() => send({ type: "heartbeat" }), 12000);
      void runAiTask({ signal, progress: (stage, message) => send({ type: "progress", stage, message }) }, async () => {
        try {
          const result = await generateStandardDraft(input);
          send(result.error ? { type: "error", message: result.error } : { type: "complete", ...result });
        } catch (error) {
          if (!signal.aborted) send({ type: "error", message: error instanceof Error ? "Drafting could not finish. Your saved work is safe; retry when ready." : "Drafting failed." });
        } finally {
          clearInterval(heartbeat);
          if (!closed) { closed = true; controller.close(); }
        }
      });
    },
    cancel() { closed = true; abort.abort(new DOMException("Drafting stopped", "AbortError")); },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" } });
}
