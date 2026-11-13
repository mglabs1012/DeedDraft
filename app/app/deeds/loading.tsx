/** Shaped like the deeds register (heading, filters, rows). */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading deeds" className="animate-pulse">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="space-y-3">
          <div className="h-4 w-36 rounded bg-secondary" />
          <div className="h-8 w-28 rounded bg-secondary" />
          <div className="h-4 w-72 max-w-full rounded bg-secondary" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-secondary" />
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-border bg-card p-3 sm:mt-7 sm:p-5">
        <div className="h-10 rounded-lg bg-secondary" />
        {Array.from({ length: 7 }, (_, index) => <div className="h-14 rounded-lg bg-secondary/70" key={index} />)}
      </div>
    </div>
  );
}
