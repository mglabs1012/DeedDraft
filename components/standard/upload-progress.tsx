"use client";
import { CheckCircle2, FileText, LoaderCircle, Pause, Play, RotateCcw } from "lucide-react";
import type { UploadJob } from "./use-upload-engine";

const bytes = (value: number) => value >= 1024 * 1024 ? (value / 1024 / 1024).toFixed(1) + " MB" : Math.round(value / 1024) + " KB";
const labels = { queued: "Waiting", authorizing: "Connecting to storage", uploading: "Uploading", retrying: "Reconnecting", paused: "Paused", processing: "Uploaded · validating and saving", complete: "Saved", error: "Needs attention" };
export function UploadProgress({ jobs, pause, resume }: { jobs: UploadJob[]; pause: (id: string) => void; resume: (id: string) => void }) {
  if (!jobs.length) return null;
  const total = jobs.reduce((sum, job) => sum + job.file.size, 0);
  const sent = jobs.reduce((sum, job) => sum + job.sent, 0);
  return <section aria-label="Upload progress" className="rounded-xl border border-border bg-card p-4">
    <div className="mb-3 flex justify-between gap-3 text-xs"><span className="font-medium">Uploads · {jobs.filter((job) => job.state === "complete").length}/{jobs.length} saved</span><span className="text-muted-foreground">{bytes(sent)} / {bytes(total)} transferred</span></div>
    <ul className="max-h-72 space-y-4 overflow-auto">{jobs.map((job) => {
      const percent = Math.min(100, Math.floor(job.sent / job.file.size * 100));
      return <li key={job.id}>
        <div className="flex items-center gap-2 text-xs">
          {job.state === "complete" ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" /> : job.state === "processing" || job.state === "authorizing" ? <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" /> : <FileText className="size-4 shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate font-medium">{job.file.name}</span><span>{percent}%</span>
          {["paused", "error"].includes(job.state) ? <button type="button" onClick={() => resume(job.id)} className="flex items-center gap-1 rounded px-2 py-1 text-primary hover:bg-secondary">{job.state === "paused" ? <Play className="size-3" /> : <RotateCcw className="size-3" />}{job.uploaded ? "Retry processing" : "Resume"}</button> : !["processing", "complete"].includes(job.state) ? <button type="button" aria-label={"Pause " + job.file.name} onClick={() => pause(job.id)} className="rounded p-1 hover:bg-secondary"><Pause className="size-3" /></button> : null}
        </div>
        <progress aria-label={job.file.name + " upload"} className="mt-2 h-1.5 w-full overflow-hidden rounded-full accent-[var(--primary)]" value={job.sent} max={job.file.size} />
        <p role={job.state === "error" ? "alert" : undefined} className={"mt-1 text-[11px] " + (job.state === "error" ? "text-destructive" : "text-muted-foreground")}>{job.error || labels[job.state]} · {bytes(job.sent)} / {bytes(job.file.size)}</p>
      </li>;
    })}</ul>
    <p className="mt-3 text-[10px] text-muted-foreground">Progress measures bytes sent. “Saved” appears only after storage validation. Interrupted transfers resume from confirmed chunks.</p>
  </section>;
}
