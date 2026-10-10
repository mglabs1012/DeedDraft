"use client";

import { CheckCircle2, CircleAlert, Loader2, PlugZap } from "lucide-react";
import { useState, useTransition } from "react";

import { testAiConnection, type AiDiagnostics } from "@/app/actions/ai";
import { Button } from "@/components/ui/button";

/** Shows the Amazon Bedrock setup and sends a tiny test request to each model. */
export function AiConnection({ configured }: { configured: boolean }) {
  const [result, setResult] = useState<AiDiagnostics | null>(null);
  const [pending, startTransition] = useTransition();

  const run = () =>
    startTransition(async () => {
      try {
        setResult(await testAiConnection());
      } catch {
        setResult({ configured, region: "", model: "", extractionModel: "", fastModel: "", ping: { ok: false, error: "The check could not be run. Try again." } });
      }
    });

  const rows: [string, string][] = result
    ? [
        ["AWS region", result.region || "—"],
        ["Drafting model", result.model],
        ["Reading / OCR model", result.extractionModel],
        ["Fast model (name conversion)", result.fastModel + (result.fastPing ? (result.fastPing.ok ? " · " + result.fastPing.latencyMs + " ms" : " · " + result.fastPing.error) : "")],
      ]
    : [];

  return (
    <div className="space-y-4">
      {!configured ? (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          AWS_REGION, AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are not set on the server. Add them to .env.local and restart.
        </p>
      ) : null}
      <Button disabled={pending || !configured} onClick={run} type="button" variant="outline">
        {pending ? <Loader2 className="animate-spin" /> : <PlugZap />} {pending ? "Testing…" : "Test AI connection"}
      </Button>
      {result ? (
        <div className="space-y-3">
          {result.ping ? (
            <div className={"flex items-start gap-2 rounded-lg border p-3 text-sm " + (result.ping.ok ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-destructive/40 bg-destructive/5 text-destructive")}>
              {result.ping.ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> : <CircleAlert className="mt-0.5 size-4 shrink-0" />}
              <p className="min-w-0 break-words">{result.ping.ok ? "Working. Answered in " + result.ping.latencyMs + " ms by " + (result.ping.servedBy ?? result.model) + "." : result.ping.error}</p>
            </div>
          ) : null}
          <dl className="divide-y divide-border rounded-lg border border-border text-sm">
            {rows.map(([label, value]) => (
              <div className="grid gap-1 px-3 py-2 sm:grid-cols-[14rem_1fr]" key={label}>
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="min-w-0 break-words font-medium text-primary">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  );
}
