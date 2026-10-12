/** Sliding-window rate limit (pure). Returns true and records the call when allowed. */
export function takeSlot(store: Map<string, number[]>, key: string, limit: number, now = Date.now(), windowMs = 60_000) {
  if (limit <= 0) return true;
  const calls = (store.get(key) ?? []).filter((at) => now - at < windowMs);
  if (calls.length >= limit) {
    store.set(key, calls);
    return false;
  }
  calls.push(now);
  store.set(key, calls);
  if (store.size > 5000) for (const [entry, times] of store) if (!times.some((at) => now - at < windowMs)) store.delete(entry);
  return true;
}
