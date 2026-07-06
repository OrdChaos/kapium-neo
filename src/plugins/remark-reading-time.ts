import type { Root } from 'mdast';
import type { VFile } from 'vfile';
import { toString } from 'mdast-util-to-string';

export function remarkReadingTime() {
  return (tree: Root, vfile: VFile) => {
    const text = toString(tree);

    const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
    const enWords = (text.match(/[a-zA-Z][a-zA-Z'-]*/g) || []).length;

    const minutes = Math.ceil(cjkChars / 400 + enWords / 200);

    if (vfile.data.astro?.frontmatter) {
      vfile.data.astro.frontmatter.readTime = minutes || 1;
    }
  };
}
