/**
 * Type definitions for current Next.js App Router page component props.
 *
 * Next.js passes dynamic route and search params as Promises.
 */

export type MaybePromise<T> = T | Promise<T>;

/**
 * Standard page props for dynamic routes with params.
 * @template T - The shape of params object (e.g., { unitId: string })
 */
export interface DynamicPageProps<T extends Record<string, string | string[]>> {
  params: Promise<T>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Page props for routes with only search params.
 */
export interface SearchPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export async function resolveRouteParams<T extends Record<string, string | string[]>>(
  params: MaybePromise<T>
): Promise<T> {
  if (params && typeof params === 'object' && 'then' in params) {
    return await params;
  }

  return params;
}

export async function resolveSearchParams(
  searchParams?: MaybePromise<Record<string, string | string[] | undefined>>
): Promise<Record<string, string | string[] | undefined>> {
  if (!searchParams) {
    return {};
  }

  if (searchParams && typeof searchParams === 'object' && 'then' in searchParams) {
    return await searchParams;
  }

  return searchParams;
}

/**
 * Helper type for extracting params from DynamicPageProps.
 */
export type ExtractParams<T extends DynamicPageProps<any>> =
  T extends DynamicPageProps<infer P> ? P : never;
