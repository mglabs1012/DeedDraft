import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { listMemory } from "@/app/actions/memory";
import { AiMemoryManager } from "@/components/settings/ai-memory";
import { isAiConfigured } from "@/lib/ai/claude";

export const metadata = { title: "AI memory" };

// Reading an uploaded deed with AI can take a minute or two.
export const maxDuration = 300;

export default async function AiMemoryPage() {
  const result = await listMemory();
  const memory = result.error === undefined ? result : { available: false, notes: [], references: [], builtIns: [] };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline" href="/app/settings"><ArrowLeft className="size-4" /> Settings</Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-primary sm:text-3xl">AI memory</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Teach the AI how your office drafts. Everything here is shared with your firm and used for AI drafting, reviews and the Ask AI chat.</p>
      </div>
      <AiMemoryManager aiEnabled={isAiConfigured()} available={memory.available} builtIns={memory.builtIns} notes={memory.notes} references={memory.references} />
    </div>
  );
}
