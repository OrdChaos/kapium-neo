import { visit } from 'unist-util-visit';
import type { Element, Root } from 'hast';
import { siteConfig } from '../config/site.ts';

const IMAGE_ORIGIN = `https://${siteConfig.imageHostname}`;

// These formats are already final assets; do not generate <source> entries.
export const PASSTHROUGH_EXTENSIONS = new Set(['gif', 'svg', 'ico']);

export interface ImageInfo {
  year: string;
  month: string;
  hash: string;
  ext: string;
}

export function parseImageUrl(src: string): ImageInfo | null {
  let url: URL;
  try {
    url = new URL(src, IMAGE_ORIGIN);
  } catch {
    return null;
  }

  if (url.origin !== IMAGE_ORIGIN) return null;

  const match = url.pathname.match(/^\/(\d{4})\/(\d{2})\/([0-9a-f]+)\/image\.([a-z0-9]+)$/i);
  if (!match) return null;

  return {
    year: match[1],
    month: match[2],
    hash: match[3],
    ext: match[4].toLowerCase(),
  };
}

export function imageUrl(info: ImageInfo, fmt: string): string {
  return `${IMAGE_ORIGIN}/${info.year}/${info.month}/${info.hash}/image.${fmt}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function buildPictureHtml(src: string, alt: string, imgAttrs = 'loading="lazy"'): string {
  const info = parseImageUrl(src);
  if (!info || PASSTHROUGH_EXTENSIONS.has(info.ext))
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" ${imgAttrs}>`;

  const img = `<img src="${imageUrl(info, info.ext)}" alt="${escapeHtml(alt)}" ${imgAttrs}>`;

  const sources = ['avif', 'webp']
    .filter((fmt) => fmt !== info.ext)
    .map((fmt) => `<source type="image/${fmt}" srcset="${imageUrl(info, fmt)}">`)
    .join('');

  return `<picture>${sources}${img}</picture>`;
}

export function rehypePicture() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'img' || !parent || index === undefined) return;
      if (parent.type === 'element' && parent.tagName === 'picture') return;

      const src = node.properties?.src;
      if (typeof src !== 'string') return;

      const info = parseImageUrl(src);
      if (!info || PASSTHROUGH_EXTENSIONS.has(info.ext)) return;

      const sources = ['avif', 'webp']
        .filter((fmt) => fmt !== info.ext)
        .map((fmt): Element => ({
          type: 'element',
          tagName: 'source',
          properties: { type: `image/${fmt}`, srcSet: imageUrl(info, fmt) },
          children: [],
        }));

      const fallback: Element = {
        ...node,
        properties: { ...node.properties, src: imageUrl(info, info.ext) },
      };

      const picture: Element = {
        type: 'element',
        tagName: 'picture',
        properties: {},
        children: [...sources, fallback],
      };

      parent.children[index] = picture;
    });
  };
}
