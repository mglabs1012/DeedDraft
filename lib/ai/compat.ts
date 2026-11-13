/**
 * Model compatibility. Newer Claude models refuse a fixed temperature or a
 * forced tool call, and older ones have no adaptive thinking. When Bedrock
 * rejects a request for one of these options, the client drops just that
 * option and retries, instead of failing the user's request.
 */
export type Feature = "thinking" | "effort" | "temperature" | "forcedTool";

const isValidation = (error: unknown): error is Error => error instanceof Error && error.name === "ValidationException";

/** Which of the options that were sent the validation error names, if any. Remembered for the model. */
export function rejectedFeature(error: unknown, sent: Set<Feature>): Feature | null {
  if (!isValidation(error)) return null;
  const message = error.message.toLowerCase();
  const match: Array<[Feature, RegExp]> = [
    ["effort", /effort|output_config/],
    ["thinking", /thinking|reasoning/],
    ["forcedTool", /tool_?choice|toolchoice/],
    ["temperature", /temperature|top_p|sampling/],
  ];
  return match.find(([feature, pattern]) => sent.has(feature) && pattern.test(message))?.[0] ?? null;
}

/**
 * A rejection that names none of the options, while reasoning was requested:
 * this one request is retried as a normal answer (nothing is remembered,
 * because the cause may be something else, such as the size of the input).
 */
export function retryWithoutReasoning(error: unknown, sent: Set<Feature>) {
  return isValidation(error) && sent.has("thinking") && rejectedFeature(error, sent) === null;
}
