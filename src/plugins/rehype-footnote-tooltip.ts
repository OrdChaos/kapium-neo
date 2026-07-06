import type { Root, Element } from 'hast';
import { visit } from 'unist-util-visit';

export function rehypeFootnoteTooltip() {
  return (tree: Root) => {
    const footnoteTexts = new Map<string, string>();

    visit(tree, 'element', (node: Element) => {
      if (
        node.properties?.id &&
        typeof node.properties.id === 'string' &&
        node.properties.id.startsWith('user-content-fn-')
      ) {
        footnoteTexts.set(node.properties.id, extractText(node));
      }
    });

    if (footnoteTexts.size === 0) return;

    visit(tree, 'element', (node: Element, index, parent) => {
      if (node.tagName !== 'a') return;
      const props = node.properties || {};
      const hasFootnoteRef = 'dataFootnoteRef' in props || 'data-footnote-ref' in props;
      if (!hasFootnoteRef || !props.href || index === undefined || !parent) return;

      const targetId = String(props.href).replace('#', '');
      const text = footnoteTexts.get(targetId);
      if (!text) return;

      const tooltipSpan: Element = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['footnote-tooltip'],
        },
        children: [{ type: 'text', value: text }],
      };

      const wrapper: Element = {
        type: 'element',
        tagName: 'span',
        properties: {
          className: ['group', 'relative', 'inline-flex'],
        },
        children: [node, tooltipSpan],
      };

      (parent as { children: Element[] }).children[index] = wrapper;
    });
  };
}

function extractText(node: Element): string {
  let text = '';

  for (const child of node.children || []) {
    if (child.type === 'text') {
      text += child.value;
    } else if (child.type === 'element') {
      const el = child as Element;
      if (el.properties?.dataFootnoteBackref === '') continue;
      text += extractText(el);
    }
  }

  return text.trim().replace(/\s+/g, ' ');
}
