import { getCollection } from 'astro:content';
import { siteConfig } from '@/config/site';
import type { APIRoute } from 'astro';

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toRFC3339(date: Date): string {
  function pad(n: number) {
    return n.toString().padStart(2, '0');
  }
  const y = date.getUTCFullYear();
  const m = pad(date.getUTCMonth() + 1);
  const d = pad(date.getUTCDate());
  const h = pad(date.getUTCHours());
  const min = pad(date.getUTCMinutes());
  const s = pad(date.getUTCSeconds());
  return `${y}-${m}-${d}T${h}:${min}:${s}Z`;
}

export const GET: APIRoute = async ({ site: siteUrl, url: requestUrl }) => {
  const posts = await getCollection('posts');

  const sortedPosts = posts
    .sort((a, b) => {
      return new Date(b.data.date).getTime() - new Date(a.data.date).getTime();
    })
    .slice(0, 20);

  const site = siteUrl?.toString() ?? siteConfig.url.toString();
  const siteTitle = siteConfig.rss?.title ?? siteConfig.title;
  const siteDescription = siteConfig.rss?.description ?? siteConfig.description;
  const authorName = siteConfig.author.name;
  const authorEmail = siteConfig.author.email;

  const feedUpdated =
    sortedPosts.length > 0 ? toRFC3339(new Date(sortedPosts[0].data.date)) : toRFC3339(new Date());

  const atomUrl = new URL('/atom.xml', requestUrl ?? site).href;

  const entries = sortedPosts
    .map((post) => {
      const postUrl = new URL(`/posts/${post.data.abbrlink}/`, site).href;
      const pubDate = new Date(post.data.date);
      const published = toRFC3339(pubDate);
      const updated = post.data.updated ? toRFC3339(new Date(post.data.updated)) : published;

      const title = escapeXml(post.data.title);
      const summary = escapeXml(post.data.excerpt ?? post.data.summary ?? '');
      const content = escapeXml(post.body ?? '');

      const categories = [post.data.category, ...(post.data.tags ?? [])]
        .filter((c): c is string => Boolean(c))
        .map((c) => `    <category term="${escapeXml(c)}"/>`)
        .join('\n');

      return `  <entry>
    <title>${title}</title>
    <link href="${escapeXml(postUrl)}"/>
    <id>${escapeXml(postUrl)}</id>
    <published>${published}</published>
    <updated>${updated}</updated>
    <author>
      <name>${escapeXml(authorName)}</name>
      <email>${escapeXml(authorEmail)}</email>
    </author>
    <summary>${summary}</summary>
    <content type="html">${content}</content>
${categories}
  </entry>`;
    })
    .join('\n\n');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>${escapeXml(siteTitle)}</title>
  <subtitle>${escapeXml(siteDescription)}</subtitle>
  <link href="${escapeXml(atomUrl)}" rel="self"/>
  <link href="${escapeXml(site)}"/>
  <id>${escapeXml(site)}</id>
  <updated>${feedUpdated}</updated>
  <author>
    <name>${escapeXml(authorName)}</name>
    <email>${escapeXml(authorEmail)}</email>
  </author>
  <generator uri="https://astro.build/">Astro</generator>
  <rights>© ${new Date().getUTCFullYear()} ${escapeXml(authorName)}</rights>

${entries}
</feed>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/atom+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
};
