"use client";

/** Deletion cascades and cannot be undone, so it asks first. */
export function DeletePaper({
  id, title, action, className = "", redirectTo,
}: {
  id: string;
  title: string;
  action: (fd: FormData) => Promise<void>;
  className?: string;
  /** Where to go afterwards. Omit when the list can simply re-render in place. */
  redirectTo?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        const ok = confirm(
          `Delete “${title}”?\n\nIts notes, excerpts, tags, links and PDF go with it. This cannot be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      {redirectTo && <input type="hidden" name="redirectTo" value={redirectTo} />}
      <button className="icon-danger" aria-label={`Delete ${title}`} title="Delete this paper">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h16" />
          <path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
          <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
          <path d="M10.5 11v6M13.5 11v6" />
        </svg>
      </button>
    </form>
  );
}
