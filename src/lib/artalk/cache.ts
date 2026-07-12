/**
 * Artalk 缓存 API
 *
 * 覆盖：缓存预热、缓存清理。
 */
import type { ArtalkClient } from './client';

/** 预热缓存（预加载以提升首次请求性能） */
export function warmUpCache(c: ArtalkClient): Promise<{ msg: string }> {
  return c.post('/cache/warm_up');
}

/** 清空所有服务端缓存 */
export function flushCache(c: ArtalkClient): Promise<{ msg: string }> {
  return c.post('/cache/flush');
}
