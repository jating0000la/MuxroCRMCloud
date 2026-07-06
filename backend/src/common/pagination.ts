/**
 * Pagination utilities for database queries
 * Standardizes pagination across all list endpoints
 */

export interface PaginationQuery {
  page?: number | string;
  limit?: number | string;
  skip?: number | string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasMore: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const MIN_LIMIT = 1;

/**
 * Parse pagination parameters from query string
 * @param query Request query parameters
 * @returns Parsed pagination values
 */
export function parsePagination(query: PaginationQuery) {
  const limit = Math.min(
    Math.max(
      parseInt(String(query.limit || DEFAULT_LIMIT), 10),
      MIN_LIMIT,
    ),
    MAX_LIMIT,
  );

  const page = Math.max(parseInt(String(query.page || 1), 10), 1);
  const skip = (page - 1) * limit;

  return { limit, page, skip };
}

/**
 * Create paginated response with metadata
 * @param data Result items
 * @param total Total count of items
 * @param query Pagination query
 * @returns Formatted paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  query: PaginationQuery,
): PaginatedResult<T> {
  const { limit, page, skip } = parsePagination(query);
  const pages = Math.ceil(total / limit);

  return {
    data,
    meta: {
      total,
      page,
      limit,
      pages,
      hasMore: skip + limit < total,
    },
  };
}

/**
 * Parse sort parameters
 * @param sortBy Field to sort by
 * @param sortOrder asc or desc
 * @returns Prisma orderBy object
 */
export function parseSort(
  sortBy: string = 'createdAt',
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  const validFields = [
    'createdAt',
    'updatedAt',
    'name',
    'email',
    'phone',
    'status',
  ];
  const field = validFields.includes(sortBy) ? sortBy : 'createdAt';
  return { [field]: sortOrder };
}
