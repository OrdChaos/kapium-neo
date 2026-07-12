/**
 * Artalk 评论 API
 *
 * 覆盖：评论列表查询、创建、详情、更新、删除。
 */
import type { ArtalkClient } from './client';
import type {
  GetCommentsParams,
  CommentListResponse,
  CommentCreateParams,
  CookedComment,
  CommentUpdateParams,
  CommentGetResponse,
} from './types';

/**
 * 获取评论列表
 * `page_key` 为必填，标记当前页面。
 */
export function getComments(
  c: ArtalkClient,
  params: GetCommentsParams,
): Promise<CommentListResponse> {
  const siteName = params.site_name ?? c.siteName;
  return c.get('/comments', { ...params, site_name: siteName });
}

/** 创建新评论 */
export function createComment(c: ArtalkClient, data: CommentCreateParams): Promise<CookedComment> {
  const siteName = data.site_name || c.siteName;
  return c.post('/comments', { ...data, site_name: siteName });
}

/** 获取单条评论详情（含父评论） */
export function getComment(c: ArtalkClient, id: number): Promise<CommentGetResponse> {
  return c.get(`/comments/${id}`);
}

/** 更新评论（需管理员权限） */
export function updateComment(
  c: ArtalkClient,
  id: number,
  data: CommentUpdateParams,
): Promise<CookedComment> {
  return c.put(`/comments/${id}`, data);
}

/** 删除评论（需管理员权限） */
export function deleteComment(c: ArtalkClient, id: number): Promise<unknown> {
  return c.delete(`/comments/${id}`);
}
