"use client";

import "./globals.css";

/** Catches failures in the root layout itself, so it renders its own document. */
export default function GlobalError({
  error, reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="flex min-h-screen items-center justify-center px-4">
          <div className="max-w-md space-y-4 text-center">
            <h1 className="text-xl font-semibold">That did not load</h1>
            <p className="text-sm text-muted">
              {error.message || "Something went wrong loading the page."}
            </p>
            <button className="btn" onClick={reset}>Try again</button>
          </div>
        </div>
      </body>
    </html>
  );
}
