import api from './api';

/**
 * Shared pagination helper for endpoints that return arrays or paginated responses.
 * Fetches full pages until a short page is returned, capped for safety.
 *
 * Handles two response shapes:
 *  - Plain array: keeps fetching while the batch is full (batch.length === limit)
 *  - Paginated object: uses `totalPages` or `total` to determine when to stop
 */
export async function fetchAllPages<T>(
  url: string,
  params: Record<string, unknown> = {},
  options: { maxPageLimit?: number; maxPages?: number; deduplicateKey?: string } = {},
): Promise<T[]> {
  const MAX_PAGE_LIMIT = options.maxPageLimit ?? 200;
  const MAX_PAGES_SAFETY = options.maxPages ?? 25;

  const all: T[] = [];
  let page = 1;
  while (page <= MAX_PAGES_SAFETY) {
    const { data } = await api.get(url, { params: { ...params, page, limit: MAX_PAGE_LIMIT } });
    const batch: T[] = Array.isArray(data) ? data : data?.data || [];
    all.push(...batch);

    // Determine if there are more pages
    if (Array.isArray(data)) {
      // Plain array response: if we got a full page, there may be more
      if (batch.length < MAX_PAGE_LIMIT) break;
    } else {
      // Paginated response: use totalPages or compute from total
      const totalPages =
        data?.totalPages ||
        (data?.total ? Math.ceil(data.total / MAX_PAGE_LIMIT) : page);
      if (page >= totalPages) break;
    }

    page++;
  }

  // Deduplicate across pages if a key is specified
  if (options.deduplicateKey && all.length > 0) {
    const seen = new Set<string | number>();
    return all.filter((item) => {
      const key = (item as any)[options.deduplicateKey!];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return all;
}
