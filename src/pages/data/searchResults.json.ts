import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { getPostExcerpt, stripMarkdown } from '@/lib/utils';

export const prerender = true;

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
        excerpt: getPostExcerpt(post) || content.slice(0, 160),
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
