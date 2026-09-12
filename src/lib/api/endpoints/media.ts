/**
 * Media — kitchen and food-prep videos, and customer comments on them.
 *
 * Reads are public. The comments read still benefits from a token when there is
 * one — it is the only way the API can flag which comments are the caller's own
 * (`is_mine`) — and the client attaches it whenever a session exists. Posting
 * and deleting need a session.
 */
import { apiClient, unwrap } from '../client';
import {
  normalizeMediaComment,
  normalizeMediaVideo,
  normalizePaginated,
} from '../normalize';
import type { ApiEnvelope, Paginated, PaginationMeta } from '../types/common';
import type { MediaComment, MediaVideo } from '../types/media';

type Raw = Record<string, unknown>;
type PaginatedBody = { data?: Raw[]; meta?: PaginationMeta };

/** GET /media-videos — published videos, newest first, 12 per page. */
export async function getMediaVideos(page?: number): Promise<Paginated<MediaVideo>> {
  const { data } = await apiClient.get<PaginatedBody>('/media-videos', {
    params: { page },
  });
  return normalizePaginated(data, normalizeMediaVideo);
}

/** GET /media-videos/{id} — 404s for drafts and deleted videos. */
export async function getMediaVideo(id: number | string): Promise<MediaVideo> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>(`/media-videos/${id}`);
  return normalizeMediaVideo(unwrap(data));
}

/** GET /media-videos/{id}/comments — visible comments, newest first, 20 per page. */
export async function getMediaComments(
  videoId: number | string,
  page?: number,
): Promise<Paginated<MediaComment>> {
  const { data } = await apiClient.get<PaginatedBody>(
    `/media-videos/${videoId}/comments`,
    { params: { page } },
  );
  return normalizePaginated(data, normalizeMediaComment);
}

/**
 * POST /media-videos/{id}/comments
 *
 * 422 when the body is too short or too long, 429 when posting faster than the
 * API allows (5 a minute), 401 without a session.
 */
export async function createMediaComment(
  videoId: number | string,
  body: string,
): Promise<MediaComment> {
  const { data } = await apiClient.post<ApiEnvelope<Raw>>(
    `/media-videos/${videoId}/comments`,
    { body },
  );
  return normalizeMediaComment(unwrap(data));
}

/** DELETE /media-comments/{id} — the author's own comment only (403 otherwise). */
export async function deleteMediaComment(id: number | string): Promise<void> {
  await apiClient.delete(`/media-comments/${id}`);
}
