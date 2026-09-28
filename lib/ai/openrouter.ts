import "server-only";

/**
 * Minimal OpenRouter client (OpenAI-compatible chat completions).
 * Server-only: the API key never reaches the browser.
 * Docs: https://openrouter.ai/docs
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export type AiUsage = { model: string; promptTokens?: number; completionTokens?: number; cost?: number };

export class AiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AiError";
  }
}

export function isAiConfigured() {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function aiModel(kind: "default" | "extraction" = "default") {
  if (kind === "extraction" && process.env.OPENROUTER_EXTRACTION_MODEL) return process.env.OPENROUTER_EXTRACTION_MODEL;
  return process.env.OPENROUTER_MODEL || DEFAULT_MODEL;
}

type CompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number };
};

export async function chatCompletion({
  messages,
  model = aiModel(),
  json = false,
  maxTokens = 4000,
  temperature = 0.2,
  timeoutMs = 90_000,
}: {
  messages: ChatMessage[];
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
}): Promise<{ text: string; usage: AiUsage }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new AiError("AI is not configured. Add OPENROUTER_API_KEY to the environment.");

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://deeddraft.app",
        "X-Title": "DeedDraft",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        usage: { include: true },
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
    throw new AiError(timedOut ? "The AI request timed out. Try again or use a smaller file." : "Could not reach OpenRouter.");
  }

  const body = (await response.json().catch(() => ({}))) as CompletionResponse;
  if (!response.ok || body.error) {
    const status = body.error?.code ?? response.status;
    const reason =
      status === 401 ? "The OpenRouter API key is invalid."
      : status === 402 ? "The OpenRouter account has insufficient credits."
      : status === 403 ? "OpenRouter refused the request (403). Check the key's limits, the model's availability, or outbound network access."
      : status === 429 ? "AI rate limit reached. Please wait a moment and retry."
      : body.error?.message || "The AI provider returned an error (" + status + ").";
    throw new AiError(reason, status);
  }

  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AiError("The AI returned an empty response.");
  return {
    text,
    usage: { model: body.model ?? model, promptTokens: body.usage?.prompt_tokens, completionTokens: body.usage?.completion_tokens, cost: body.usage?.cost },
  };
}
