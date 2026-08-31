export default function About() {
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <div className="max-w-xl space-y-5 text-center">
        <h1 className="font-display text-xl font-semibold tracking-wide">About</h1>

        <p className="text-base leading-relaxed">
          Build your personal research library, one paper at a time.
        </p>

        <p className="text-sm leading-relaxed text-muted">
          Store each paper’s details, notes, tags, core questions, and what you learned.
          Connect papers to the work they build on, challenge, or extend, and watch your
          research graph grow.
        </p>

        <p className="text-sm leading-relaxed text-muted">
          Return to your library months or years later to see not just what you read, but{" "}
          <strong className="font-semibold text-fg">
            what you learned, how your thinking evolved, and how ideas connect.
          </strong>
        </p>

        <p className="font-display text-sm font-semibold tracking-wide text-accent">
          A record of what you read. A map of what you know.
        </p>

        <p className="pt-3 text-xs text-muted">
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
      </div>
    </div>
  );
}
