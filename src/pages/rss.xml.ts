import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { siteConfig } from '@/config/site';
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ site: siteUrl }) => {
  const posts = await getCollection('posts');

  const sortedPosts = posts
    .sort((a, b) => {
      return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
    })
    .slice(0, 20);

  const site = siteUrl ?? siteConfig.url;

  return rss({
    title: siteConfig.rss?.title ?? siteConfig.title,
    description: siteConfig.rss?.description ?? siteConfig.description,
    site,
    items: sortedPosts.map((post) => ({
      title: post.data.title,
      description: post.data.excerpt ?? post.data.summary ?? '',
      content: post.body,
      pubDate: new Date(post.data.date),
      link: `/posts/${post.data.abbrlink}/`,
      categories: [post.data.category, ...(post.data.tags ?? [])].filter(
        (category): category is string => Boolean(category),
      ),
    })),
    customData: `<language>zh-CN</language>`,
  });
};
