import { finishStandardUpload, prepareStandardUpload } from "@/app/actions/upload";
import { getCurrentUser } from "@/lib/workspace";

export const runtime = "nodejs";
export const maxDuration = 300;
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const { user } = await getCurrentUser();
  if (!user) return Response.json({ error: "Please sign in again." }, { status: 401 });
  const text = await request.text();
  if (text.length > 4000) return Response.json({ error: "Request is too large." }, { status: 413 });
  let body: { operation?: string; input?: unknown };
  try { body = JSON.parse(text); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  if (body.operation !== "prepare" && body.operation !== "finish") return Response.json({ error: "Invalid operation." }, { status: 400 });
  const result = body.operation === "prepare" ? await prepareStandardUpload(body.input) : await finishStandardUpload(body.input);
  return Response.json(result, {
    status: "retryable" in result && result.retryable ? 503 : 200,
    headers: { "Cache-Control": "private, no-store" },
  });
}
