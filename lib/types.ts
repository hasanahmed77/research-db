export type PaperStatus = "to_read" | "reading" | "read" | "archived";
export type TagKind = "topic" | "method" | "dataset" | "task" | "metric" | "application";
export type TagRole = "about" | "introduces" | "uses" | "evaluates_on" | "improves" | "compares_against";
export type LinkType =
  | "extends" | "contradicts" | "reproduces" | "applies"
  | "alternative_to" | "surveys" | "prerequisite_for" | "related";

export const STATUSES: PaperStatus[] = ["to_read", "reading", "read", "archived"];
export const TAG_KINDS: TagKind[] = ["topic", "method", "dataset", "task", "metric", "application"];
export const TAG_ROLES: TagRole[] = ["about", "introduces", "uses", "evaluates_on", "improves", "compares_against"];
/**
 * Relations offered in the UI, in menu order — the first is the default.
 * "cites" writes a citation, the rest write a paper_link; the link_type enum
 * still holds its other values so older rows stay valid.
 */
export const EDGE_KINDS = ["related", "cites", "contradicts"] as const;

export type PaperCard = {
  id: string;
  title: string;
  year: number | null;
  status: PaperStatus;
  rating: number | null;
  summary: string | null;
  pdf_path: string | null;
  url: string | null;
  is_stub: boolean;
  read_at: string | null;
  created_at: string;
  venue: string | null;
  authors: string[];
  tags: string[];
  notes_filled: number;
  notes_total: number;
  cites_out: number;
  cited_by: number;
  cite_key: string | null;
};

export type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  year: number | null;
  venue_id: string | null;
  doi: string | null;
  arxiv_id: string | null;
  url: string | null;
  pdf_path: string | null;
  bibtex: string | null;
  cite_key: string | null;
  is_stub: boolean;
  status: PaperStatus;
  rating: number | null;
  summary: string | null;
  read_at: string | null;
};

export type NotePrompt = { id: string; key: string; title: string; guidance: string | null; ord: number };
export type Tag = { id: string; name: string; kind: TagKind; parent_id: string | null };
export type Excerpt = { id: string; page: number | null; quote: string; comment: string | null };
