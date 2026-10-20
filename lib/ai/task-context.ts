import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

export type DraftStage = "loading" | "converting" | "drafting" | "saving";
type Context = { signal: AbortSignal; progress: (stage: DraftStage, message: string) => void };
const tasks = new AsyncLocalStorage<Context>();
export const runAiTask = <T>(context: Context, run: () => Promise<T>) => tasks.run(context, run);
export const taskSignal = () => tasks.getStore()?.signal;
export function assertTaskActive() { taskSignal()?.throwIfAborted(); }
export function reportDraftStage(stage: DraftStage, message: string) {
  assertTaskActive();
  tasks.getStore()?.progress(stage, message);
}
