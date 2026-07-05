import { toString } from 'mdast-util-to-string';

export function remarkExcerpt() {
  return (tree, vfile) => {
    const children = tree.children;
    const excerptNodes = [];

    for (const node of children) {
      if (node.type === 'html' && /<!--\s*more\s*-->/.test(node.value)) {
        const text = toString({ type: 'root', children: excerptNodes });
        if (vfile.data.astro?.frontmatter) {
          vfile.data.astro.frontmatter.excerpt = text.trim();
        }
        return;
      }
      excerptNodes.push(node);
    }
  };
}
