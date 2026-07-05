import { umamiConfig } from '@/config/umami';

export interface UmamiPageViewsResult {
  pageViews: number | null;
  error: boolean;
}

export async function fetchUmamiPageViews(path: string): Promise<UmamiPageViewsResult> {
  const { apiUrl, websiteId, apiToken } = umamiConfig;

  const startAt = new Date('2020-01-01').getTime().toString();
  const endAt = Date.now().toString();

  const params = new URLSearchParams({ startAt, endAt, path });

  try {
    const res = await fetch(`${apiUrl}/websites/${websiteId}/stats?${params}`, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Umami API error: ${res.status} - ${errText}`);
    }

    const data = await res.json();

    const pv = typeof data?.pageviews === 'number' ? data.pageviews : (data?.pageviews?.value ?? 0);

    return { pageViews: pv, error: false };
  } catch (err) {
    console.error('Failed to fetch Umami page views:', err);
    return { pageViews: null, error: true };
  }
}
