/** Shaped like the deed workspace (title, tabs, upload area, people), so the page does not jump when it arrives. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Opening deed" className="animate-pulse space-y-7">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="h-4 w-24 rounded bg-secondary" />
          <div className="h-4 w-48 max-w-[50%] rounded bg-secondary" />
        </div>
        <div className="mt-4 h-9 w-2/3 max-w-xl rounded bg-secondary" />
        <div className="mt-4 flex gap-2 border-b border-border pb-2">
          <div className="h-6 w-32 rounded bg-secondary" />
          <div className="h-6 w-20 rounded bg-secondary" />
        </div>
      </div>
      <div className="h-52 rounded-2xl bg-secondary" />
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => <div className="h-[4.5rem] rounded-xl bg-secondary" key={index} />)}
      </div>
      <div className="h-64 rounded-xl bg-secondary" />
    </div>
  );
}
