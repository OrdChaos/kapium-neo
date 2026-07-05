// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import icon from 'astro-icon';

import remarkMath from 'remark-math';
import remarkPangu from 'remark-pangu';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';

import { remarkGroupImages } from './src/plugins/remark-group-images.mjs';
import { remarkExcerpt } from './src/plugins/remark-excerpt.mjs';
import { remarkReadingTime } from './src/plugins/remark-reading-time.mjs';
import { rehypeFootnoteTooltip } from './src/plugins/rehype-footnote-tooltip.mjs';
import { rehypeCodeBlockWrapper } from './src/plugins/rehype-code-block-wrapper.mjs';

import photosuite from 'photosuite';

export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
  },

  integrations: [
    react(),
    icon(),
    photosuite({
      scope: '#post-content',
      imageGrid: false,
      exif: false,
      imageAlts: false,
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
