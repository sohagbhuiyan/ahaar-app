/**
 * Homepage CMS content — public, unauthenticated read.
 *
 * `GET /home?platform=app` is the shared source for this app and the website;
 * the `platform` parameter is what makes the API return the sections an admin
 * enabled for mobile rather than the website's marketing sections. Everything
 * inactive, or outside its scheduling window, is already filtered out server-side
 * — the app renders what it is given, in the order it is given.
 */
import { apiClient, unwrap } from '../client';
import { normalizeHomeContent } from '../normalize';
import type { HomeContent } from '../types/home';
import type { ApiEnvelope } from '../types/common';

type Raw = Record<string, unknown>;

/** GET /home?platform=app */
export async function getHomeContent(): Promise<HomeContent> {
  const { data } = await apiClient.get<ApiEnvelope<Raw>>('/home', {
    params: { platform: 'app' },
  });
  return normalizeHomeContent(unwrap(data));
}
