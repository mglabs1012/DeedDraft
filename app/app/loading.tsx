export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="animate-pulse space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-secondary" />
        <div className="h-8 w-64 max-w-full rounded bg-secondary" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <div className="h-32 rounded-xl bg-secondary" key={index} />)}
      </div>
      <div className="h-72 rounded-xl bg-secondary" />
    </div>
  );
}
