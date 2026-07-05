import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

const stripMarkdown = (input: string) =>
  input
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

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');

  const results = posts
    .filter((post) => post.data.abbrlink)
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf())
    .map((post) => {
      const content = stripMarkdown(post.body ?? '');

      return {
        id: post.data.abbrlink,
        title: post.data.title,
        excerpt: post.data.excerpt || post.data.summary || content.slice(0, 160),
        category: post.data.category || '',
        content,
        tags: post.data.tags || [],
      };
    });

  return new Response(JSON.stringify(results), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
