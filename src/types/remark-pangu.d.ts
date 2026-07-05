declare module 'remark-pangu' {
  import type { Plugin } from 'unified';

  export interface RemarkPanguOptions {
    text?: boolean;
    inlineCode?: boolean;
    link?: boolean;
    image?: boolean;
    imageReference?: boolean;
    definition?: boolean;
  }

  const remarkPangu: Plugin<[RemarkPanguOptions?]>;

  export default remarkPangu;
}
