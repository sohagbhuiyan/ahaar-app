/**
 * The Media section — kitchen and food-prep videos, and the comments on them.
 *
 * Mirrors the public reads under `/media-videos`. Nothing here is admin-shaped:
 * uploading and moderation happen in the web admin panel.
 */

export interface MediaVideo {
  id: number;
  title: string;
  description: string | null;
  video_url: string;
  mime_type: string | null;
  /** `null` when the video has no poster — the card shows a plain panel. */
  poster_url: string | null;
  /** `null` when the length is unknown. */
  duration_seconds: number | null;
  /** Visible comments only; removed ones are never counted. */
  comments_count: number;
  published_at: string | null;
}

export interface MediaCommentAuthor {
  id: number | null;
  /** "Aziz K." — the API shortens names to a first name and last initial. */
  name: string;
}

export interface MediaComment {
  id: number;
  body: string;
  created_at: string;
  author: MediaCommentAuthor;
  /** True only when the signed-in customer wrote it. Drives "Delete". */
  is_mine: boolean;
}

/** The server's length rule, mirrored so the composer can say so before a 422. */
export const COMMENT_MIN_LENGTH = 2;
export const COMMENT_MAX_LENGTH = 1000;
