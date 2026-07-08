import type { Root, Image, Paragraph, Link } from 'mdast';
import type { Node } from 'unist';

interface ImageInfo {
  url: string;
  alt: string;
}

interface GiInfo {
  total: number;
  rows: number[];
  endgiInSameNode: boolean;
}

export function remarkGroupImages() {
  return (tree: Root) => {
    const children = tree.children;
    const newChildren: typeof children = [];
    let i = 0;

    while (i < children.length) {
      const node = children[i];

      const giInfo = findGiMarker(node as Paragraph);

      if (!giInfo) {
        newChildren.push(node);
        i++;
        continue;
      }

      const { total, rows, endgiInSameNode } = giInfo;

      if (endgiInSameNode) {
        const images = extractImagesFromNode(node);
        const html = buildGridHtml(images, total, rows);
        newChildren.push({ type: 'html', value: html });
        i++;
        continue;
      }

      const images = extractImagesFromNode(node);
      let j = i + 1;
      let endIdx = -1;

      while (j < children.length) {
        const candidate = children[j];

        if (hasEndgiMarker(candidate as Paragraph)) {
          const imgs = extractImagesBeforeEndgi(candidate as Paragraph);
          images.push(...imgs);
          endIdx = j;
          break;
        }

        const found = extractImagesFromNode(candidate);
        images.push(...found);
        j++;
      }

      if (endIdx === -1) {
        newChildren.push(node);
        i++;
        continue;
      }

      const html = buildGridHtml(images, total, rows);
      newChildren.push({ type: 'html', value: html });
      i = endIdx + 1;
    }

    tree.children = newChildren;
  };
}

function findGiMarker(node: Paragraph | null): GiInfo | null {
  if (node?.type !== 'paragraph') return null;

  const fullText = (node.children || []).map((c) => ('value' in c ? c.value : '')).join('');

  const giMatch = fullText.match(/\{%\s*gi\s+(\d+)\s*([\d-]*)\s*%\}/);
  if (!giMatch) return null;

  const total = parseInt(giMatch[1], 10);
  const rowsStr = giMatch[2];

  let rows: number[];
  if (rowsStr) {
    rows = rowsStr.split('-').map((n) => parseInt(n, 10));
    const sum = rows.reduce((a, b) => a + b, 0);
    if (sum !== total) rows = [];
  }
  if (!rows!) {
    rows = [];
    let remaining = total;
    while (remaining > 0) {
      const take = Math.min(remaining, 3);
      rows.push(take);
      remaining -= take;
    }
  }

  const endgiInSameNode = /\{%\s*endgi\s*%\}/.test(fullText);
  return { total, rows, endgiInSameNode };
}

function hasEndgiMarker(node: Paragraph): boolean {
  if (node.type !== 'paragraph') return false;
  const text = (node.children || []).map((c) => ('value' in c ? c.value : '')).join('');
  return /\{%\s*endgi\s*%\}/.test(text);
}

function extractImagesFromNode(node: Node): ImageInfo[] {
  const images: ImageInfo[] = [];

  if (node.type === 'image') {
    const img = node as Image;
    images.push({ url: img.url, alt: img.alt || '' });
    return images;
  }

  if (node.type === 'paragraph') {
    for (const child of (node as Paragraph).children || []) {
      if (child.type === 'image') {
        const img = child as Image;
        images.push({ url: img.url, alt: img.alt || '' });
      }
      if (child.type === 'link') {
        for (const inner of (child as Link).children || []) {
          if (inner.type === 'image') {
            const img = inner as Image;
            images.push({ url: img.url, alt: img.alt || '' });
          }
        }
      }
    }
  }

  return images;
}

function extractImagesBeforeEndgi(node: Paragraph): ImageInfo[] {
  const images: ImageInfo[] = [];
  if (node.type !== 'paragraph') return images;

  for (const child of node.children || []) {
    if (
      'value' in child &&
      typeof child.value === 'string' &&
      /\{%\s*endgi\s*%\}/.test(child.value)
    ) {
      break;
    }
    if (child.type === 'image') {
      const img = child as Image;
      images.push({ url: img.url, alt: img.alt || '' });
    }
    if (child.type === 'link') {
      for (const inner of (child as Link).children || []) {
        if (inner.type === 'image') {
          const img = inner as Image;
          images.push({ url: img.url, alt: img.alt || '' });
        }
      }
    }
  }

  return images;
}

function buildGridHtml(images: ImageInfo[], total: number, rows: number[]): string {
  const actualTotal = Math.min(total, images.length);
  let html = '<div class="gi-container">';

  let idx = 0;
  for (const count of rows) {
    html += '<div class="gi-row">';
    for (let c = 0; c < count && idx < actualTotal; c++) {
      const img = images[idx];
      html += `<img src="${img.url}" alt="${img.alt}" loading="lazy" />`;
      idx++;
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}
