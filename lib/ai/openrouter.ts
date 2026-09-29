import "server-only";

/**
 * OpenRouter client (OpenAI-compatible chat completions).
 * Server-only: the API key never reaches the browser.
 *
 * Reliability:
 * - 429 / 5xx / network errors are retried with backoff, honouring Retry-After.
 * - OPENROUTER_FALLBACK_MODELS lets OpenRouter route to another model when the
 *   primary is rate-limited or down (https://openrouter.ai/docs/features/model-routing).
 * - Errors surface OpenRouter's own reason (and the upstream provider's), so a
 *   "rate limit" can be told apart from a free-tier cap or a provider outage.
 */

const API = "https://openrouter.ai/api/v1";
const DEFAULT_MODEL = "google/gemini-2.5-flash";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } }
  | { type: "file"; file: { filename: string; file_data: string } };

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string | ContentPart[] };

export type AiUsage = { model: string; promptTokens?: number; completionTokens?: number; cost?: number };

export class AiError extends Error {
  constructor(message: string, readonly status?: number, readonly retryable = false) {
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

export function fallbackModels() {
  return (process.env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);
}

/** PDF engine for OpenRouter's file parser: "native" (model reads the PDF), "mistral-ocr" (best for scans) or "pdf-text". */
export function pdfEngine() {
  const engine = process.env.OPENROUTER_PDF_ENGINE;
  return engine === "mistral-ocr" || engine === "pdf-text" || engine === "native" ? engine : undefined;
}

type CompletionResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: string | null }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string; code?: number; metadata?: { raw?: unknown; provider_name?: string; reasons?: string[] } };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function headers() {
  return {
    Authorization: "Bearer " + process.env.OPENROUTER_API_KEY,
    "Content-Type": "application/json",
    "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://deeddraft.app",
    "X-Title": "DeedDraft",
  };
}

function describeError(status: number, body: CompletionResponse, model: string) {
  const provider = body.error?.metadata?.provider_name;
  const raw = body.error?.metadata?.raw;
  const detail = [body.error?.message, typeof raw === "string" ? raw : raw ? JSON.stringify(raw).slice(0, 300) : ""].filter(Boolean).join(" — ");
  const free = model.endsWith(":free");
  switch (status) {
    case 401:
      return "The OpenRouter API key is invalid or revoked. Check OPENROUTER_API_KEY.";
    case 402:
      return "The OpenRouter account has insufficient credits. Add credits at openrouter.ai/credits.";
    case 403:
      return "OpenRouter refused the request (403)" + (detail ? ": " + detail : "") + ". Check the key's spending limit and that the model is allowed.";
    case 408:
      return "The AI provider timed out. Try again or use a smaller file.";
    case 429:
      return (
        "Rate limited" + (provider ? " by " + provider : "") + (detail ? ": " + detail : "") + ". " +
        (free
          ? "Free models (\":free\") allow only a few requests per minute and per day — switch OPENROUTER_MODEL to a paid model."
          : "If this repeats, add credits (free-tier keys are capped), set OPENROUTER_FALLBACK_MODELS, or use Settings → AI connection to diagnose.")
      );
    default:
      return (status >= 500 ? "The AI provider is unavailable (" + status + ")" : "The AI request failed (" + status + ")") + (detail ? ": " + detail : ".");
  }
}

export async function chatCompletion({
  messages,
  model = aiModel(),
  json = false,
  maxTokens = 4000,
  temperature = 0.2,
  timeoutMs = 90_000,
  retries = 2,
  pdf,
}: {
  messages: ChatMessage[];
  model?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  retries?: number;
  /** Override the PDF engine for this call. */
  pdf?: "native" | "mistral-ocr" | "pdf-text";
}): Promise<{ text: string; usage: AiUsage }> {
  if (!process.env.OPENROUTER_API_KEY) throw new AiError("AI is not configured. Add OPENROUTER_API_KEY to the environment.");

  const fallbacks = fallbackModels().filter((candidate) => candidate !== model);
  const engine = pdf ?? pdfEngine();
  const hasFile = messages.some((message) => Array.isArray(message.content) && message.content.some((part) => part.type === "file"));
  const payload = JSON.stringify({
    model,
    ...(fallbacks.length ? { models: [model, ...fallbacks] } : {}),
    messages,
    temperature,
    max_tokens: maxTokens,
    usage: { include: true },
    ...(json ? { response_format: { type: "json_object" } } : {}),
    ...(hasFile && engine ? { plugins: [{ id: "file-parser", pdf: { engine } }] } : {}),
  });

  let lastError: AiError | null = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(API + "/chat/completions", { method: "POST", headers: headers(), body: payload, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
      lastError = new AiError(timedOut ? "The AI request timed out. Try again or use a smaller file." : "Could not reach OpenRouter. Check the server's internet access.", undefined, !timedOut);
      if (!lastError.retryable || attempt === retries) throw lastError;
      await sleep(1500 * 2 ** attempt);
      continue;
    }

    const body = (await response.json().catch(() => ({}))) as CompletionResponse;
    const status = body.error?.code ?? (response.ok ? 200 : response.status);
    if (status !== 200 || body.error) {
      const retryable = status === 429 || status === 408 || status >= 500;
      lastError = new AiError(describeError(status, body, model), status, retryable);
      if (!retryable || attempt === retries) throw lastError;
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter, 10) * 1000 : 2000 * 2 ** attempt);
      continue;
    }

    const text = body.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) throw new AiError("The AI returned an empty response. Try again or choose a different model.");
    return {
      text,
      usage: { model: body.model ?? model, promptTokens: body.usage?.prompt_tokens, completionTokens: body.usage?.completion_tokens, cost: body.usage?.cost },
    };
  }
  throw lastError ?? new AiError("The AI request failed.");
}

export type KeyStatus = {
  label?: string;
  usage?: number;
  limit?: number | null;
  limitRemaining?: number | null;
  isFreeTier?: boolean;
};

/** Reads the key's limits and usage (https://openrouter.ai/docs/api-reference/limits). */
export async function keyStatus(): Promise<KeyStatus> {
  if (!process.env.OPENROUTER_API_KEY) throw new AiError("OPENROUTER_API_KEY is not set.");
  let response: Response;
  try {
    response = await fetch(API + "/key", { headers: headers(), signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    throw new AiError("Could not reach OpenRouter. Check the server's internet access.");
  }
  const body = (await response.json().catch(() => ({}))) as { data?: { label?: string; usage?: number; limit?: number | null; limit_remaining?: number | null; is_free_tier?: boolean }; error?: { message?: string } };
  if (!response.ok || !body.data) throw new AiError(response.status === 401 ? "The OpenRouter API key is invalid or revoked." : body.error?.message || "Could not read key status (" + response.status + ").", response.status);
  return { label: body.data.label, usage: body.data.usage, limit: body.data.limit, limitRemaining: body.data.limit_remaining, isFreeTier: body.data.is_free_tier };
}
