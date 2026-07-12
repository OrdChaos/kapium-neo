/**
 * Artalk 投票 API
 *
 * 覆盖：投票状态查询、创建投票、数据同步。
 */
import type { ArtalkClient } from './client';
import type { VoteTarget, VoteChoice, VoteCreateParams, VoteResponse } from './types';

/**
 * 获取评论/页面的投票状态
 * @param targetName - 'comment' | 'page'
 * @param targetId - 目标 ID
 */
export function getVote(
  c: ArtalkClient,
  targetName: VoteTarget,
  targetId: number,
): Promise<VoteResponse> {
  return c.get(`/votes/${targetName}/${targetId}`);
}

/**
 * 创建投票（赞同/反对）
 * @param targetName - 'comment' | 'page'
 * @param targetId - 目标 ID
 * @param choice - 'up' | 'down'
 */
export function createVote(
  c: ArtalkClient,
  targetName: VoteTarget,
  targetId: number,
  choice: VoteChoice,
  data: VoteCreateParams = {},
): Promise<VoteResponse> {
  return c.post(`/votes/${targetName}/${targetId}/${choice}`, data);
}

/** 同步投票计数（将 votes 表数据同步到 comments/pages 表） */
export function syncVotes(c: ArtalkClient): Promise<unknown> {
  return c.post('/votes/sync');
}
