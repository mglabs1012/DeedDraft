import type { SavedDraft } from "@/app/actions/drafts";
import type { Localized } from "@/lib/schemas/deed-data";

export async function streamStandardDraft(input: { id: string; language: "hindi" | "english" | "both"; instructions: string }, signal: AbortSignal, onProgress: (stage: string, message: string) => void): Promise<{ drafts: SavedDraft[]; notes: string[]; localized?: Localized }> {
  const response = await fetch("/api/draft", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal });
  if (!response.ok || !response.body) throw new Error(response.status === 401 ? "Your session expired. Sign in again." : "Drafting could not start. Please retry.");
  const reader = response.body.getReader(), decoder = new TextDecoder();
  let pending = "";
  let result: { drafts: SavedDraft[]; notes: string[]; localized?: Localized } | undefined;
  const consume = (line: string) => {
    if (!line.trim()) return;
    const event = JSON.parse(line);
    if (event.type === "progress") onProgress(event.stage, event.message);
    if (event.type === "error") throw new Error(event.message);
    if (event.type === "complete" && event.draft) result = { drafts: event.drafts ?? [event.draft], notes: event.notes ?? [], localized: event.localized };
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      pending += decoder.decode(value, { stream: true });
      const lines = pending.split("\n"); pending = lines.pop() ?? "";
      for (const line of lines) consume(line);
    }
    pending += decoder.decode();
    consume(pending);
  } finally { reader.releaseLock(); }
  if (!result) throw new Error("The connection ended before drafting finished. Check Draft for a saved version before retrying.");
  return result;
}
