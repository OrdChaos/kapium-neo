import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const prerender = true;

export const GET: APIRoute = async () => {
  const posts = await getCollection('posts');
  const postIds = posts.map((post) => post.data.abbrlink).filter(Boolean);

  return new Response(JSON.stringify(postIds), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
};
