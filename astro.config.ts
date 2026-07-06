// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

import htmlMinifier from "astro-html-minifier-next";
import browserslist from "browserslist";
import { browserslistToTargets } from "lightningcss";

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import icon from 'astro-icon';

import remarkMath from 'remark-math';
import remarkPangu from 'remark-pangu';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';

import { remarkGroupImages } from './src/plugins/remark-group-images.ts';
import { remarkExcerpt } from './src/plugins/remark-excerpt.ts';
import { remarkReadingTime } from './src/plugins/remark-reading-time.ts';
import { rehypeFootnoteTooltip } from './src/plugins/rehype-footnote-tooltip.ts';
import { rehypeCodeBlockWrapper } from './src/plugins/rehype-code-block-wrapper.ts';

import photosuite from 'photosuite';
import sitemap from '@astrojs/sitemap';

import { siteConfig } from './src/config/site';

export default defineConfig({
  trailingSlash: 'always',
  build: {
    format: 'directory',
  },
  
  site: siteConfig.url,

  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    react(),
    icon(),
    sitemap(),
    photosuite({
      scope: '#post-content',
      imageGrid: false,
      exif: false,
      imageAlts: false,
    }),
    htmlMinifier({
      caseSensitive: true,
      collapseWhitespace: true,
      preserveLineBreaks: false,
      removeComments: true,
      minifyJS: true,
      minifyCSS: {
        targets: browserslistToTargets(browserslist("defaults")),
      },

      removeOptionalTags: false,
      removeAttributeQuotes: false,
      removeEmptyElements: false,
      sortAttributes: false,
      sortClassNames: false,
    }),
  ],

  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
      wrap: true,
    },

    processor: unified({
      remarkPlugins: [
        remarkMath,
        remarkGroupImages,
        remarkExcerpt,
        [
          remarkPangu,
          {
            text: true,
            inlineCode: false,
            link: true,
            image: false,
            imageReference: false,
            definition: false,
          },
        ],
        remarkReadingTime,
      ],
      rehypePlugins: [rehypeKatex, rehypeSlug, rehypeFootnoteTooltip, rehypeCodeBlockWrapper],
    }),
  },
});
