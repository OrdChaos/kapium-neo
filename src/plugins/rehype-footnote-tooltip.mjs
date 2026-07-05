import { visit } from 'unist-util-visit';

export function rehypeFootnoteTooltip() {
  return (tree) => {
    const footnoteTexts = new Map();

    visit(tree, 'element', (node) => {
      if (node.properties?.id?.startsWith('user-content-fn-')) {
        footnoteTexts.set(node.properties.id, extractText(node));
      }
    });

    if (footnoteTexts.size === 0) return;

    visit(tree, 'element', (node, index, parent) => {
      if (node.tagName !== 'a') return;
      const props = node.properties || {};
      const hasFootnoteRef = 'dataFootnoteRef' in props || 'data-footnote-ref' in props;
      if (!hasFootnoteRef || !props.href || index === undefined || !parent) return;

      const targetId = props.href.replace('#', '');
      const text = footnoteTexts.get(targetId);
      if (!text) return;

      const tooltipSpan = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['footnote-tooltip'],
        },
        children: [{ type: 'text', value: text }],
      };

      const wrapper = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['group', 'relative', 'inline-flex'],
        },
        children: [node, tooltipSpan],
      };

      parent.children[index] = wrapper;
    });
  };
}

function extractText(node) {
  let text = '';

  for (const child of node.children || []) {
    if (child.type === 'text') {
      text += child.value;
    } else if (child.type === 'element') {
      if (child.properties?.dataFootnoteBackref === '') continue;
      text += extractText(child);
    }
  }

  return text.trim().replace(/\s+/g, ' ');
}
