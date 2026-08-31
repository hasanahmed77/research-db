"use client";

/** Deletion cascades and cannot be undone, so it asks first. */
export function DeletePaper({
  id, title, action,
}: {
  id: string;
  title: string;
  action: (fd: FormData) => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        const ok = confirm(
          `Delete “${title}”?\n\nIts notes, excerpts, tags, links and PDF go with it. This cannot be undone.`,
        );
        if (!ok) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-sm hover:border-danger hover:text-danger">delete this paper</button>
    </form>
  );
}
