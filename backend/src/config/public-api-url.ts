import { ConfigService } from '@nestjs/config';

export function getPublicApiOrigin(
  config: ConfigService,
  environment: string,
  port: number,
): string | undefined {
  const configuredUrl =
    config.get<string>('PUBLIC_API_URL') ??
    config.get<string>('RENDER_EXTERNAL_URL') ??
    (environment === 'development' ? `http://localhost:${port}` : undefined);

  if (!configuredUrl) return undefined;

  const url = new URL(configuredUrl);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'PUBLIC_API_URL must be an http(s) origin without credentials, path, query, or fragment.',
    );
  }

  return url.origin;
}
