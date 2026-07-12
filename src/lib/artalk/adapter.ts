/**
 * Artalk → CommentSystem 数据适配层
 *
 * 将 Artalk API 的数据模型映射为 CommentSystem 前端组件期望的格式。
 * 封装分页、排序、投票等逻辑。
 */
import { ArtalkClient } from './client';
import type { CookedComment, ArtalkResponse } from './types';
import * as commentApi from './comment';
import * as voteApi from './vote';

// ---- CommentSystem 期望的数据模型 ----

export interface CommentItem {
  id: number;
  path: string;
  nickname: string;
  website: string | null;
  content: string;
  parentId: number | null;
  createdAt: string;
  isAdmin: boolean;
  status: 'visible' | 'pending' | 'deleted';
  likes: number;
  dislikes: number;
  userVote: 1 | -1 | 0;
  emailMd5: string | null;
}

export interface CommentListResponse {
  data: CommentItem[];
  nextCursor: number | null;
}

// ---- 内部工具 ----

/** 映射单条 Artalk 评论 → CommentItem */
function mapComment(c: CookedComment): CommentItem {
  let status: CommentItem['status'] = 'visible';
  if (c.is_collapsed) status = 'deleted';
  else if (c.is_pending) status = 'pending';

  return {
    id: c.id,
    path: c.page_key,
    nickname: c.nick,
    website: c.link || null,
    content: c.content,
    parentId: c.rid === 0 ? null : c.rid,
    createdAt: c.date,
    isAdmin: c.badge_name === 'Admin' || c.is_verified,
    status,
    likes: c.vote_up,
    dislikes: c.vote_down,
    userVote: 0, // Artalk 评论列表不返回投票状态
    emailMd5: c.email_encrypted || null,
  };
}

// ---- 对外 API ----

/**
 * 获取评论列表
 * @param client Artalk 客户端
 * @param pageKey 页面标识（即 path）
 * @param cursor 分页游标（内部用 offset 实现）
 * @param limit 每页条数，默认 20
 */
export async function fetchComments(
  client: ArtalkClient,
  pageKey: string,
  cursor?: number,
  limit = 20,
): Promise<CommentListResponse> {
  const offset = cursor ?? 0;

  const result = await commentApi.getComments(client, {
    page_key: pageKey,
    flat_mode: false,
    sort_by: 'date_desc',
    limit,
    offset,
  });

  const list = result.comments.map(mapComment);
  const nextOffset = offset + limit;
  const hasMore = list.length === limit;

  return {
    data: list,
    nextCursor: hasMore ? nextOffset : null,
  };
}

/**
 * 发表评论（或回复）
 */
export async function postComment(
  client: ArtalkClient,
  payload: {
    path: string;
    nickname: string;
    content: string;
    email?: string;
    website?: string;
    parentId?: number;
    /** User-Agent（对齐官方前端，可选） */
    ua?: string;
    /** 页面标题（对齐官方前端，可选） */
    pageTitle?: string;
  },
): Promise<CommentItem> {
  const created = await commentApi.createComment(client, {
    page_key: payload.path,
    name: payload.nickname,
    email: payload.email ?? '',
    content: payload.content,
    site_name: client.siteName,
    link: payload.website,
    rid: payload.parentId,
    ua: payload.ua,
    page_title: payload.pageTitle,
  });

  return mapComment(created);
}

/**
 * 投票（赞同/反对）
 * @param voteValue 1 = 赞成, -1 = 反对
 */
export async function submitVote(
  client: ArtalkClient,
  commentId: number,
  voteValue: 1 | -1,
): Promise<void> {
  const choice = voteValue === 1 ? 'up' : 'down';
  await voteApi.createVote(client, 'comment', commentId, choice);
}
