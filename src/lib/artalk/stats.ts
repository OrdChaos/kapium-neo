/**
 * Artalk 统计 API
 *
 * 覆盖：各类数据统计接口。
 */
import type { ArtalkClient } from './client';
import type { GetStatsParams } from './types';

/**
 * 获取统计数据
 *
 * `type` 可选值：
 * - `latest_comments` - 最新评论
 * - `latest_pages` - 最新页面
 * - `pv_most_pages` - PV 最多的页面
 * - `comment_most_pages` - 评论最多的页面
 * - `page_pv` - 页面 PV
 * - `site_pv` - 站点 PV
 * - `page_comment` - 页面评论数
 * - `site_comment` - 站点评论数
 * - `rand_comments` - 随机评论
 * - `rand_pages` - 随机页面
 */
export function getStats(c: ArtalkClient, params: GetStatsParams): Promise<unknown> {
  const { type, ...rest } = params;
  const siteName = rest.site_name ?? c.siteName;
  const query: Record<string, unknown> = { site_name: siteName };
  if (rest.limit !== undefined) query.limit = rest.limit;
  if (rest.page_keys) query.page_keys = rest.page_keys;
  return c.get(`/stats/${type}`, query);
}
