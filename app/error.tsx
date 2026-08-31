"use client";

export default function ErrorBoundary({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="font-display text-xl font-semibold tracking-wide">
          That did not load
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          {error.message || "Your library could not be reached just now."}
        </p>
        <button className="btn" onClick={reset}>Try again</button>
        {error.digest && (
          <p className="text-xs text-muted">reference {error.digest}</p>
        )}
      </div>
    </div>
  );
}
