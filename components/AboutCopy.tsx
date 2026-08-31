/**
 * Shared by /about and the signed-out home screen, so the pitch stays in one
 * place. "hero" sizes it up for the landing split and drops the attribution,
 * which belongs on the about page rather than the front door.
 */
export function AboutCopy({
  variant = "page", className = "",
}: {
  variant?: "page" | "hero";
  className?: string;
}) {
  const hero = variant === "hero";

  return (
    <div className={`${hero ? "max-w-2xl space-y-6" : "max-w-xl space-y-5"} ${className}`}>
      {!hero && (
        <h1 className="font-display text-xl font-semibold tracking-wide">About</h1>
      )}

      <p
        className={
          hero
            ? "font-display text-4xl font-semibold leading-[1.15] tracking-tight"
            : "text-base leading-relaxed"
        }
      >
        Build your personal research library, one paper at a time.
      </p>

      <p className={hero ? "text-base leading-relaxed text-muted" : "text-sm leading-relaxed text-muted"}>
        Store each paper’s details, notes, tags, core questions, and what you learned.
        Connect papers to the work they build on, challenge, or extend, and watch your
        research graph grow.
      </p>

      <p className={hero ? "text-base leading-relaxed text-muted" : "text-sm leading-relaxed text-muted"}>
        Return to your library months or years later to see not just what you read, but{" "}
        <strong className="font-semibold text-fg">
          what you learned, how your thinking evolved, and how ideas connect.
        </strong>
      </p>

      <p
        className={`font-display font-semibold tracking-wide text-accent ${
          hero ? "text-lg" : "text-sm"
        }`}
      >
        A record of what you read. A map of what you know.
      </p>

      {!hero && (
        <p className="pt-1 text-xs text-muted">
          The eight questions come from{" "}
          <a
            href="https://cseweb.ucsd.edu/~wgg/CSE210/howtoread.html"
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-accent"
          >
            How to Read an Engineering Research Paper
          </a>
          .
        </p>
      )}
    </div>
  );
}
