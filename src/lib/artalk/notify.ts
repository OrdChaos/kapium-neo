/**
 * Artalk 通知 API
 *
 * 覆盖：通知列表、单条已读、全部已读。
 */
import type { ArtalkClient } from './client';
import type { GetNotifiesParams, NotifyListResponse, NotifyReadAllParams } from './types';

/** 获取用户的通知列表 */
export function getNotifies(
  c: ArtalkClient,
  params: GetNotifiesParams,
): Promise<NotifyListResponse> {
  return c.get('/notifies', { name: params.name, email: params.email });
}

/** 标记单条通知为已读 */
export function markNotifyRead(
  c: ArtalkClient,
  commentId: number,
  notifyKey: string,
): Promise<unknown> {
  return c.post(`/notifies/${commentId}/${notifyKey}`);
}

/** 标记用户所有通知为已读 */
export function markAllNotifyRead(c: ArtalkClient, params: NotifyReadAllParams): Promise<unknown> {
  return c.post('/notifies/read', params);
}
