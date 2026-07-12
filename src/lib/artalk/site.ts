/**
 * Artalk 站点 API
 *
 * 覆盖：站点列表、创建、更新、删除。
 */
import type { ArtalkClient } from './client';
import type { SiteListResponse, SiteCreateParams, CookedSite } from './types';

/** 获取所有站点 */
export function getSites(c: ArtalkClient): Promise<SiteListResponse> {
  return c.get('/sites');
}

/** 创建站点 */
export function createSite(c: ArtalkClient, data: SiteCreateParams): Promise<CookedSite> {
  return c.post('/sites', data);
}

/** 更新站点 */
export function updateSite(
  c: ArtalkClient,
  id: number,
  data: SiteCreateParams,
): Promise<CookedSite> {
  return c.put(`/sites/${id}`, data);
}

/** 删除站点 */
export function deleteSite(c: ArtalkClient, id: number): Promise<unknown> {
  return c.delete(`/sites/${id}`);
}
