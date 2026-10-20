import "server-only";
import { assertTaskActive, taskSignal } from "./task-context";

import {
  BedrockRuntimeClient,
  ConverseCommand,
  type ContentBlock,
  type DocumentFormat,
  type ImageFormat,
  type Message,
  type SystemContentBlock,
  type ToolInputSchema,
} from "@aws-sdk/client-bedrock-runtime";
import { PDFDocument } from "pdf-lib";
import sharp from "sharp";

import { krutiDevToUnicode, looksLikeKrutiDev } from "@/lib/text/krutidev";

/**
 * Claude on Amazon Bedrock through the Converse API (@aws-sdk/client-bedrock-runtime).
 * One request, one complete response: no streaming. Server-only, so AWS
 * credentials never reach the browser.
 *
 * Environment:
 *   AWS_REGION                   e.g. ap-south-1
 *   AWS_ACCESS_KEY_ID            IAM user with bedrock:InvokeModel (AmazonBedrockFullAccess)
 *   AWS_SECRET_ACCESS_KEY
 *   BEDROCK_MODEL_ID             main model, default global.anthropic.claude-sonnet-4-6 (profile ID or ARN)
 *   BEDROCK_EXTRACTION_MODEL_ID  optional, document reading only
 *   BEDROCK_FAST_MODEL_ID        optional, quick tasks (name conversion, anonymising); falls back to the main model
 */

const DEFAULT_MODEL = "global.anthropic.claude-sonnet-4-6";
const REQUEST_TIMEOUT_MS = 115_000;

/** Converse API limits per request. */
const MAX_PDF_BYTES = 4_500_000;
const MAX_IMAGE_BYTES = 3_750_000;
/** Claude reads images at up to ~1568 px on the long edge; larger only adds upload time. */
const IMAGE_EDGE = 1568;
export const MAX_DOCUMENTS_PER_REQUEST = 5;

export type ContentPart = ContentBlock;
export type ModelKind = "default" | "extraction" | "fast";
export type AiUsage = {
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  latencyMs?: number;
};

export class AiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "AiError";
  }
}

const env = (name: string) => process.env[name]?.trim() || undefined;

export function isAiConfigured() {
  return Boolean(env("AWS_REGION") && env("AWS_ACCESS_KEY_ID") && env("AWS_SECRET_ACCESS_KEY"));
}

export const AI_NOT_CONFIGURED = "AI is not configured. Add AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to .env.local and restart the app.";

export function aiModel(kind: ModelKind = "default") {
  const main = env("BEDROCK_MODEL_ID") || DEFAULT_MODEL;
  if (kind === "extraction") return env("BEDROCK_EXTRACTION_MODEL_ID") || main;
  if (kind === "fast") return env("BEDROCK_FAST_MODEL_ID") || main;
  return main;
}

let cached: BedrockRuntimeClient | null = null;

function client() {
  cached ??= new BedrockRuntimeClient({
    region: env("AWS_REGION"),
    credentials: { accessKeyId: env("AWS_ACCESS_KEY_ID")!, secretAccessKey: env("AWS_SECRET_ACCESS_KEY")!, sessionToken: env("AWS_SESSION_TOKEN") },
    // Adaptive retries back off on throttling instead of failing the request.
    maxAttempts: 3,
    retryMode: "adaptive",
  });
  return cached;
}

function describe(error: unknown, model: string): AiError {
  if (error instanceof AiError) return error;
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
  switch (name) {
    case "UnrecognizedClientException":
    case "InvalidSignatureException":
    case "CredentialsProviderError":
      return new AiError("AWS rejected the credentials. Check AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.", 401);
    case "AccessDeniedException":
      return new AiError("Bedrock refused the request: " + message, 403);
    case "ResourceNotFoundException":
      return new AiError("The model " + model + " was not found in " + env("AWS_REGION") + ". Check the BEDROCK_*_MODEL_ID settings.", 404);
    case "ThrottlingException":
    case "ServiceQuotaExceededException":
      return new AiError("AI is busy right now. Please wait a moment and retry.", 429);
    case "ValidationException":
      return new AiError("The AI rejected the request: " + message, 400);
    case "ModelTimeoutException":
    case "TimeoutError":
    case "AbortError":
      return new AiError("The AI request timed out. Try again or use a smaller file.");
    case "ModelNotReadyException":
    case "ServiceUnavailableException":
    case "InternalServerException":
    case "ModelErrorException":
      return new AiError("Bedrock is temporarily unavailable. Please retry in a minute.", status);
  }
  console.error("Unexpected AI error", error);
  return new AiError("The AI request failed. Please try again.", status);
}

type CallOptions = {
  /** Instructions. Stable text goes first so it can be cached. */
  system: string;
  /** Large stable context (memory, reference drafts) placed after the instructions and cached for 5 minutes. */
  cachedContext?: string;
  /** A single user turn, or a full conversation. */
  content: string | ContentPart[] | Message[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
};

const isConversation = (content: CallOptions["content"]): content is Message[] => Array.isArray(content) && content.length > 0 && "role" in (content[0] as object);

/** Prompt-cache breakpoints need ~1,024+ tokens before them to take effect; shorter prefixes are sent uncached. */
function systemBlocks(system: string, cachedContext?: string): SystemContentBlock[] {
  const blocks: SystemContentBlock[] = [{ text: system }];
  if (cachedContext) blocks.push({ text: cachedContext });
  if ((system.length + (cachedContext?.length ?? 0)) > 3500) blocks.push({ cachePoint: { type: "default" } });
  return blocks;
}

async function converse(options: CallOptions & { toolConfig?: ConstructorParameters<typeof ConverseCommand>[0]["toolConfig"] }) {
  if (!isAiConfigured()) throw new AiError(AI_NOT_CONFIGURED);
  const model = options.model ?? aiModel();
  const started = Date.now();
  const messages: Message[] = isConversation(options.content)
    ? options.content
    : [{ role: "user", content: typeof options.content === "string" ? [{ text: options.content }] : (options.content as ContentPart[]) }];
  try {
    const response = await client().send(
      new ConverseCommand({
        modelId: model,
        system: systemBlocks(options.system, options.cachedContext),
        messages,
        inferenceConfig: { maxTokens: options.maxTokens ?? 8192, temperature: options.temperature ?? 0.2 },
        ...(options.toolConfig ? { toolConfig: options.toolConfig } : {}),
      }),
      { abortSignal: AbortSignal.any([AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS), ...(taskSignal() ? [taskSignal()!] : [])]) },
    );
    if (response.stopReason === "max_tokens") throw new AiError("The AI response was cut off at the output limit. Try fewer or smaller documents.");
    if (response.stopReason === "content_filtered" || response.stopReason === "guardrail_intervened") throw new AiError("The AI declined to process this request.");
    const usage: AiUsage = {
      model,
      promptTokens: response.usage?.inputTokens,
      completionTokens: response.usage?.outputTokens,
      cacheReadTokens: response.usage?.cacheReadInputTokens,
      cacheWriteTokens: response.usage?.cacheWriteInputTokens,
      latencyMs: Date.now() - started,
    };
    return { blocks: response.output?.message?.content ?? [], usage };
  } catch (error) {
    assertTaskActive();
    throw describe(error, model);
  }
}

/** Sends one request and waits for the complete text response. */
export async function generate(options: CallOptions): Promise<{ text: string; usage: AiUsage }> {
  const { blocks, usage } = await converse(options);
  const text = blocks.flatMap((block) => (block.text !== undefined ? [block.text] : [])).join("\n").trim();
  if (!text) throw new AiError("The AI returned an empty response.");
  return { text, usage };
}

/**
 * Structured output: the model must call one tool whose input matches the
 * JSON schema, so the reply is always parseable. Callers still validate it.
 */
export async function generateJson<T = Record<string, unknown>>(
  options: CallOptions & { schema: Record<string, unknown>; name: string; description: string },
): Promise<{ data: T; usage: AiUsage }> {
  const { blocks, usage } = await converse({
    ...options,
    toolConfig: {
      tools: [{ toolSpec: { name: options.name, description: options.description, inputSchema: { json: options.schema } as ToolInputSchema } }],
      toolChoice: { tool: { name: options.name } },
    },
  });
  const call = blocks.find((block) => block.toolUse?.name === options.name)?.toolUse;
  if (call?.input && typeof call.input === "object") return { data: call.input as T, usage };
  // Fallback: a model that answered in text instead of calling the tool.
  const text = blocks.flatMap((block) => (block.text !== undefined ? [block.text] : [])).join("\n");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return { data: JSON.parse(text.slice(start, end + 1)) as T, usage };
    } catch {
      /* fall through */
    }
  }
  throw new AiError("The AI response could not be read. Please try again.");
}

/* ------------------------------------------------------------ File handling */

/** Converse document names allow letters, digits, spaces, hyphens, parentheses and brackets only. */
function documentName(fileName: string, part?: number) {
  const base = fileName.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9\s\-()[\]]/g, " ").replace(/\s+/g, " ").trim().slice(0, 150) || "document";
  return part ? base + " part " + part : base;
}

/** Splits a PDF into page ranges that each fit the Converse document limit. */
async function splitPdf(bytes: Uint8Array): Promise<Uint8Array[]> {
  const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const chunks: Uint8Array[] = [];
  let pages: number[] = [];
  const build = async (indices: number[]) => {
    const out = await PDFDocument.create();
    for (const page of await out.copyPages(source, indices)) out.addPage(page);
    return out.save();
  };
  for (let index = 0; index < source.getPageCount(); index += 1) {
    const candidate = await build([...pages, index]);
    if (candidate.byteLength <= MAX_PDF_BYTES) {
      pages.push(index);
      continue;
    }
    if (!pages.length) throw new AiError("Page " + (index + 1) + " of this PDF is larger than 4.5 MB. Rescan it at a lower resolution.");
    chunks.push(await build(pages));
    pages = [index];
  }
  if (pages.length) chunks.push(await build(pages));
  return chunks;
}

/**
 * Prepares a photo or scan for reading: fixes phone rotation, evens out faint
 * photocopies and resizes to the size Claude reads at (faster upload, same detail).
 */
async function prepareImage(bytes: Uint8Array) {
  try {
    const image = sharp(bytes, { failOn: "none" }).rotate();
    const meta = await image.metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);
    const out = await image
      .resize(longEdge > IMAGE_EDGE ? { width: meta.width && meta.height && meta.width >= meta.height ? IMAGE_EDGE : undefined, height: meta.width && meta.height && meta.height > meta.width ? IMAGE_EDGE : undefined, withoutEnlargement: true } : undefined)
      .normalise({ lower: 1, upper: 99 })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
    if (out.byteLength <= MAX_IMAGE_BYTES) return out;
    return await sharp(out).jpeg({ quality: 70 }).toBuffer();
  } catch {
    throw new AiError("This image could not be read. Upload a JPG or PNG photo or scan.");
  }
}

/**
 * Typed text inside a PDF. Hindi deeds are often typed in the legacy Kruti Dev
 * font, which extracts as garbled Latin; that is converted to Unicode here so
 * the model gets clean Hindi alongside the page images.
 */
export async function pdfTextLayer(bytes: Uint8Array): Promise<{ text: string; krutiDev: boolean; pages: number }> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text, totalPages } = await extractText(pdf, { mergePages: true });
    const clean = text.replace(/[ \t]+/g, " ").trim();
    const krutiDev = looksLikeKrutiDev(clean);
    return { text: krutiDev ? krutiDevToUnicode(clean) : clean, krutiDev, pages: totalPages };
  } catch {
    return { text: "", krutiDev: false, pages: 0 };
  }
}

/**
 * Content blocks for an uploaded PDF, JPG or PNG. Large PDFs are split by
 * pages, photos are straightened and resized, and Kruti Dev text is converted.
 */
export async function fileBlocks(mimeType: string, data: Uint8Array, fileName: string): Promise<ContentPart[]> {
  if (mimeType === "application/pdf") {
    const parts = data.byteLength <= MAX_PDF_BYTES ? [data] : await splitPdf(data);
    const blocks: ContentPart[] = parts.map((bytes, index) => ({
      document: { format: "pdf" as DocumentFormat, name: documentName(fileName, parts.length > 1 ? index + 1 : undefined), source: { bytes } },
    }));
    const layer = await pdfTextLayer(data);
    if (layer.krutiDev && layer.text.length > 200) {
      blocks.push({
        text: "Typed text of " + fileName + ", converted from the legacy Kruti Dev Hindi font (conversion can garble a few conjuncts; when it disagrees with the page image, trust the image):\n" + layer.text.slice(0, 60000),
      });
    }
    return blocks;
  }
  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp") {
    return [{ image: { format: "jpeg" as ImageFormat, source: { bytes: await prepareImage(data) } } }];
  }
  throw new AiError("Only PDF, JPG, PNG and WebP files can be read by AI.");
}

/** Log line for usage tracking (tokens, cache hits, latency). */
export function usageDetails(usage: AiUsage) {
  return {
    model: usage.model,
    prompt_tokens: usage.promptTokens ?? null,
    completion_tokens: usage.completionTokens ?? null,
    cache_read_tokens: usage.cacheReadTokens ?? null,
    latency_ms: usage.latencyMs ?? null,
  };
}
