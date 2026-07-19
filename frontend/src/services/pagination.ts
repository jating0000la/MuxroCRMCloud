import api from './api';

/**
 * Shared pagination helper for endpoints that return arrays without total counts.
 * Fetches full pages until a short page is returned, capped for safety.
 */
export async function fetchAllPages<T>(
  url: string,
  params: Record<string, unknown> = {},
  options: { maxPageLimit?: number; maxPages?: number } = {},
): Promise<T[]> {
  const MAX_PAGE_LIMIT = options.maxPageLimit ?? 200;
  const MAX_PAGES_SAFETY = options.maxPages ?? 25;

  const all: T[] = [];
  let page = 1;
  while (page <= MAX_PAGES_SAFETY) {
    const { data } = await api.get(url, { params: { ...params, page, limit: MAX_PAGE_LIMIT } });
    const batch: T[] = Array.isArray(data) ? data : data?.data || [];
    all.push(...batch);
    const totalPages = Array.isArray(data) ? page : data?.totalPages || page;
    if (page >= totalPages || batch.length < MAX_PAGE_LIMIT) break;
    page++;
  }
  return all;
}
