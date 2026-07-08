import { umamiPageViewConfig } from '@/config/umami';

export interface UmamiPageViewsResult {
  pageViews: number | null;
  error: boolean;
}

type UmamiStatsResponse = {
  pageviews?: number | { value?: number };
};

function normalizeUmamiPath(input: string): string {
  const pathname = input.split('#')[0].split('?')[0] || '/';

  if (pathname === '/') return '/';

  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;

  if (normalized.startsWith('/posts/') && !normalized.endsWith('/')) {
    return `${normalized}/`;
  }

  return normalized;
}

function joinUrl(base: string, pathname: string): string {
  return `${base.replace(/\/+$/, '')}/${pathname.replace(/^\/+/, '')}`;
}

function getPageViewsValue(pageviews: UmamiStatsResponse['pageviews']): number {
  if (typeof pageviews === 'number') return pageviews;
  if (typeof pageviews?.value === 'number') return pageviews.value;
  return 0;
}

export async function fetchUmamiPageViews(path: string): Promise<UmamiPageViewsResult> {
  const { apiUrl, websiteId, apiToken } = umamiPageViewConfig;

  if (!apiUrl || !websiteId || !apiToken) {
    console.error('Missing Umami page view config');
    return { pageViews: null, error: true };
  }

  const startAt = new Date('2020-01-01T00:00:00+08:00').getTime().toString();
  const endAt = Date.now().toString();
  const pathname = normalizeUmamiPath(path);

  const params = new URLSearchParams({
    startAt,
    endAt,
    path: pathname,
    _t: Date.now().toString(),
  });

  try {
    const url = joinUrl(apiUrl, `/websites/${websiteId}/stats`);

    const res = await fetch(`${url}?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Umami API error: ${res.status} - ${errText}`);
    }

    const data = (await res.json()) as UmamiStatsResponse;
    const pageViews = getPageViewsValue(data.pageviews);

    return { pageViews, error: false };
  } catch (err) {
    console.error(`Failed to fetch Umami page views for path "${pathname}":`, err);
    return { pageViews: null, error: true };
  }
}
