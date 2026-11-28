/** 每页文章数 */
export const POSTS_PER_PAGE = 21;

/** 首页为 `/`，其余为 `/page/N/` */
export function pageHref(page: number) {
  return page === 1 ? '/' : `/page/${page}/`;
}

export type PageSlot = number | 'ellipsis';

/**
 * 生成页码槽位：首尾固定，中间仅保留当前页前后 `radius` 页。
 * 夹在中间的单页直接显示，只有缺口 ≥ 2 时才用省略号占位。
 */
export function buildPageSlots(
  currentPage: number,
  totalPages: number,
  radius: number,
): PageSlot[] {
  if (totalPages <= 0) return [];
  if (totalPages === 1) return [1];

  const current = Math.min(Math.max(Math.trunc(currentPage), 1), totalPages);
  const windowStart = Math.max(1, current - radius);
  const windowEnd = Math.min(totalPages, current + radius);

  const slots: PageSlot[] = [1];

  const appendGap = (from: number, to: number) => {
    if (to < from) return;
    const count = to - from + 1;
    if (count === 1) slots.push(from);
    else slots.push('ellipsis');
  };

  appendGap(2, windowStart - 1);

  for (let page = windowStart; page <= windowEnd; page++) {
    if (!slots.includes(page)) slots.push(page);
  }

  appendGap(windowEnd + 1, totalPages - 1);

  if (!slots.includes(totalPages)) slots.push(totalPages);

  return slots;
}
