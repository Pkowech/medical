/**
 * Proper type definitions for Next.js 13+ App Router page component props.
 * 
 * In Next.js 13+ with the app directory, route params are passed as Promises.
 * This utility provides consistent type definitions across all page components.
 */

/**
 * Standard page props for dynamic routes with params
 * @template T - The shape of params object (e.g., { unitId: string })
 */
export interface DynamicPageProps<T extends Record<string, string | string[]>> {
  params: Promise<T>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Page props for routes with only search params
 */
export interface SearchPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Helper type for extracting params from DynamicPageProps
 */
export type ExtractParams<T extends DynamicPageProps<any>> = 
  T extends DynamicPageProps<infer P> ? P : never;
