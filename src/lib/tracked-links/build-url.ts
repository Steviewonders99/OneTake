export interface UtmParams {
  utm_campaign: string;
  utm_source: string;
  utm_medium: string;
  utm_term: string;
  utm_content: string;
}

/**
 * Append UTM params to a base URL, properly URL-encoded.
 * Handles base URLs that already contain a query string.
 */
export function buildDestinationUrl(baseUrl: string, utm: UtmParams): string {
  const url = new URL(baseUrl);
  for (const [key, value] of Object.entries(utm)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}
