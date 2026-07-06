import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

function hasClass(node: Element, className: string): boolean {
  const cls = node.properties?.className;
  if (!cls) return false;
  if (Array.isArray(cls)) return cls.includes(className);
  return cls === className;
}

export function rehypeFootnoteSection() {
  return (tree: Root) => {
    visit(tree, 'element', (node: Element) => {
      if (node.tagName === 'section' && hasClass(node, 'footnotes')) {
        const ol = (node.children || []).find(
          (c) => c.type === 'element' && (c as Element).tagName === 'ol',
        ) as Element | undefined;
        if (!ol) return;

        const items: Element[] = [];
        for (const li of ol.children || []) {
          if (li.type !== 'element' || (li as Element).tagName !== 'li') continue;
          const liEl = li as Element;

          const id = (liEl.properties?.id as string) || '';
          const num = id.replace('user-content-fn-', '');

          const label: Element = {
            type: 'element',
            tagName: 'span',
            properties: { className: ['footnote-label'] },
            children: [{ type: 'text', value: `[${num}]` }],
          };

          const firstChild = (liEl.children || [])[0];
          if (firstChild && firstChild.type === 'element') {
            const firstEl = firstChild as Element;
            const cls = firstEl.properties?.className;
            firstEl.properties = firstEl.properties || {};
            firstEl.properties.className = Array.isArray(cls)
              ? [...cls, 'footnote-item']
              : ['footnote-item'];
            firstEl.children = [label, ...(firstEl.children || [])];
            items.push(firstEl);
          } else {
            items.push({
              type: 'element',
              tagName: 'p',
              properties: { className: ['footnote-item'] },
              children: [label, ...(liEl.children || [])],
            });
          }
        }

        const div: Element = {
          type: 'element',
          tagName: 'div',
          properties: { className: ['footnote-items'] },
          children: items,
        };

        node.children = (node.children || []).map((c) => (c === ol ? div : c));
      }
    });
  };
}
