import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function estimateReadTime(text: string): number {
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  const enWords = (text.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length;
  return Math.ceil(cjkChars / 400 + enWords / 200) || 1;
}

/**
 * 从 Markdown 文本中提取纯文本摘要。
 * 去除代码块、数学公式、HTML 标签、Markdown 语法标记等。
 */
export function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_~`|[\](){}-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Post 数据的最小接口，用于 getPostExcerpt */
export interface PostExcerptSource {
  data: { excerpt?: string; summary?: string };
  body?: string;
}

/**
 * 获取文章摘要，优先级：
 * 1. data.excerpt（frontmatter 显式定义）
 * 2. body 中 `<!-- more -->` 之前的内容（自动提取）
 * 3. data.summary
 * 4. 空字符串
 */
export function getPostExcerpt(post: PostExcerptSource): string {
  if (post.data.excerpt) return post.data.excerpt;

  if (post.body) {
    const moreMatch = post.body.match(/<!--\s*more\s*-->/);
    if (moreMatch !== null && moreMatch.index !== undefined) {
      const excerptRaw = post.body.slice(0, moreMatch.index).trim();
      return stripMarkdown(excerptRaw);
    }
  }

  return post.data.summary || '';
}
