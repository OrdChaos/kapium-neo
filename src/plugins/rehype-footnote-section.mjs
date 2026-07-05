import { visit } from 'unist-util-visit';

function hasClass(node, className) {
  const cls = node.properties?.className;
  if (!cls) return false;
  if (Array.isArray(cls)) return cls.includes(className);
  return cls === className;
}

export function rehypeFootnoteSection() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName === 'section' && hasClass(node, 'footnotes')) {
        const ol = (node.children || []).find((c) => c.type === 'element' && c.tagName === 'ol');
        if (!ol) return;

        const items = [];
        for (const li of ol.children || []) {
          if (li.type !== 'element' || li.tagName !== 'li') continue;

          const id = li.properties?.id || '';
          const num = id.replace('user-content-fn-', '');

          const label = {
            type: 'element',
            tagName: 'span',
            properties: { className: ['footnote-label'] },
            children: [{ type: 'text', value: `[${num}]` }],
          };

          const firstChild = (li.children || [])[0];
          if (firstChild && firstChild.type === 'element') {
            const cls = firstChild.properties?.className;
            firstChild.properties = firstChild.properties || {};
            firstChild.properties.className = Array.isArray(cls)
              ? [...cls, 'footnote-item']
              : ['footnote-item'];
            firstChild.children = [label, ...(firstChild.children || [])];
            items.push(firstChild);
          } else {
            items.push({
              type: 'element',
              tagName: 'p',
              properties: { className: ['footnote-item'] },
              children: [label, ...(li.children || [])],
            });
          }
        }

        const div = {
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
