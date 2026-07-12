/**
 * Artalk API 统一导出
 *
 * 使用方式：
 * ```ts
 * import { artalk, ArtalkClient } from '@/lib/artalk';
 * import { getComments, createComment } from '@/lib/artalk/comment';
 *
 * // 使用默认客户端
 * const list = await getComments(artalk, { page_key: '/posts/hello' });
 *
 * // 或创建独立客户端
 * const client = new ArtalkClient({ server: 'https://...', siteName: '...', adminToken: '...' });
 * const list = await getComments(client, { page_key: '/posts/hello' });
 * ```
 */

// ---- 基础客户端 ----
export { ArtalkClient, artalk } from './client';

// ---- 类型 ----
export type * from './types';

// ---- API 模块（按需导入，支持 tree-shaking） ----
export * as auth from './auth';
export * as comment from './comment';
export * as page from './page';
export * as site from './site';
export * as user from './user';
export * as system from './system';
export * as captcha from './captcha';
export * as notify from './notify';
export * as vote from './vote';
export * as transfer from './transfer';
export * as upload from './upload';
export * as stats from './stats';
export * as cache from './cache';

// ---- CommentSystem 适配层 ----
export * as adapter from './adapter';
