/** Small metadata requests use Route Handlers, not Next's sequential action queue. */
export async function uploadRequest<T>(operation: "prepare" | "finish", input: unknown): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operation, input }),
        signal: AbortSignal.timeout(operation === "finish" ? 280000 : 30000),
      });
      if (response.status === 401 || response.redirected) throw new Error("Your session expired. Sign in again before resuming.");
      if ([408, 429, 500, 502, 503, 504].includes(response.status) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1))); continue;
      }
      if (!response.ok) throw new Error("Upload service returned HTTP " + response.status + ". Retry when ready.");
      return await response.json() as T;
    } catch (error) {
      if (attempt === 2 || (error instanceof Error && /session|HTTP/.test(error.message))) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  throw new Error("The upload service did not respond. Your transferred chunks can be resumed.");
}
