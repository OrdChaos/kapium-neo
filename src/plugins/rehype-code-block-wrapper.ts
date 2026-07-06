import type { Root, Element } from 'hast';

function getClassList(node: Element): string[] {
  const className = node?.properties?.className ?? node?.properties?.class;

  if (Array.isArray(className)) return className as string[];
  if (typeof className === 'string') {
    return className.split(/\s+/).filter(Boolean);
  }

  return [];
}

function hasClass(node: Element, className: string): boolean {
  return getClassList(node).includes(className);
}

function getCodeNode(preNode: Element): Element | undefined {
  return (preNode.children || []).find(
    (child) => child?.type === 'element' && (child as Element).tagName === 'code',
  ) as Element | undefined;
}

function getLanguageFromCode(codeNode: Element | undefined): string | undefined {
  if (!codeNode) return undefined;
  const languageClass = getClassList(codeNode).find((className) =>
    className.startsWith('language-'),
  );
  return languageClass?.replace(/^language-/, '');
}

function getLanguage(preNode: Element): string {
  const props = preNode.properties ?? {};

  const dataLanguage = props.dataLanguage ?? props['data-language'];

  if (typeof dataLanguage === 'string' && dataLanguage.trim()) {
    return dataLanguage.trim();
  }

  return getLanguageFromCode(getCodeNode(preNode)) || 'text';
}

function isCodeBlockPre(node: Element): boolean {
  if (node?.type !== 'element' || node.tagName !== 'pre') return false;

  if (hasClass(node, 'astro-code')) return true;

  const codeNode = getCodeNode(node);
  return Boolean(getLanguageFromCode(codeNode));
}

function createWrapper(preNode: Element): Element {
  const lang = getLanguage(preNode);

  return {
    type: 'element',
    tagName: 'div',
    properties: {
      className: ['code-block-wrapper'],
    },
    children: [
      {
        type: 'element',
        tagName: 'div',
        properties: {
          className: ['code-block-header'],
        },
        children: [
          {
            type: 'element',
            tagName: 'span',
            properties: {
              className: ['code-lang'],
            },
            children: [
              {
                type: 'text',
                value: lang.toUpperCase(),
              },
            ],
          },
          {
            type: 'element',
            tagName: 'button',
            properties: {
              type: 'button',
              className: ['copy-card'],
              ariaLabel: '复制代码',
            },
            children: [
              {
                type: 'text',
                value: '复制',
              },
            ],
          },
        ],
      },
      preNode,
    ],
  };
}

function walk(node: Element): number {
  if (!node || !Array.isArray(node.children)) return 0;

  let count = 0;

  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i] as Element;

    if (child.type === 'element' && hasClass(child, 'code-block-wrapper')) {
      continue;
    }

    if (child.type === 'element' && isCodeBlockPre(child)) {
      node.children[i] = createWrapper(child);
      count++;
      continue;
    }

    if (child.type === 'element') {
      count += walk(child);
    }
  }

  return count;
}

export function rehypeCodeBlockWrapper() {
  return (tree: Root) => {
    const count = walk(tree as unknown as Element);

    if (process.env.DEBUG_CODE_BLOCK_WRAPPER === 'true') {
      console.log(`[rehype-code-block-wrapper] wrapped ${count} code block(s)`);
    }

    return tree;
  };
}
