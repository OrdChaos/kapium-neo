/**
 * Artalk 页面 API
 *
 * 覆盖：页面列表、更新、删除、PV 上报、数据抓取。
 */
import type { ArtalkClient } from './client';
import type {
  GetPagesParams,
  PageListResponse,
  PageUpdateParams,
  CookedPage,
  PagePVParams,
  PagePVResponse,
  PageFetchAllParams,
  PageFetchStatusResponse,
} from './types';

/** 获取页面列表 */
export function getPages(c: ArtalkClient, params: GetPagesParams = {}): Promise<PageListResponse> {
  const siteName = params.site_name ?? c.siteName;
  return c.get('/pages', { ...params, site_name: siteName });
}

/** 更新页面信息 */
export function updatePage(
  c: ArtalkClient,
  id: number,
  data: PageUpdateParams,
): Promise<CookedPage> {
  return c.put(`/pages/${id}`, data);
}

/** 删除页面（同时删除其下所有评论） */
export function deletePage(c: ArtalkClient, id: number): Promise<unknown> {
  return c.delete(`/pages/${id}`);
}

/** 上报并获取页面 PV */
export function logPv(c: ArtalkClient, data: PagePVParams): Promise<PagePVResponse> {
  const siteName = data.site_name ?? c.siteName;
  return c.post('/pages/pv', { ...data, site_name: siteName });
}

/** 抓取单页数据 */
export function fetchPage(c: ArtalkClient, id: number): Promise<CookedPage> {
  return c.post(`/pages/${id}/fetch`);
}

/** 批量抓取所有页面数据 */
export function fetchAllPages(c: ArtalkClient, params: PageFetchAllParams = {}): Promise<unknown> {
  return c.post('/pages/fetch', params);
}

/** 获取批量抓取进度 */
export function getPageFetchStatus(c: ArtalkClient): Promise<PageFetchStatusResponse> {
  return c.get('/pages/fetch/status');
}
