"use client";
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="font-display text-3xl">Something went wrong</h1>
      <p className="mt-3 text-mute">That action didn’t complete. Your credits and data were not changed by a failed request.</p>
      {error.digest && <p className="mt-2 text-xs text-mute">Reference: {error.digest}</p>}
      <button onClick={reset} className="btn-lime mt-6">Try again</button>
    </main>
  );
}
