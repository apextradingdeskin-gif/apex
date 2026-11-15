export default function Loading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-4 px-4 py-14" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 rounded-lg bg-raised" /><div className="h-4 w-80 rounded bg-raised" />
      <div className="grid gap-4 pt-6 md:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-32 rounded-2xl bg-panel" />)}</div>
    </div>
  );
}
