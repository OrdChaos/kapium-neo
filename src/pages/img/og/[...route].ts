import { OGImageRoute } from 'astro-og-canvas';
import { getCollection } from 'astro:content';
import { siteConfig } from '@/config/site';
import { getPostExcerpt } from '@/lib/utils';

const posts = await getCollection('posts');

const pages: Record<string, { title: string; description: string }> = {
  index: {
    title: siteConfig.title,
    description: siteConfig.description,
  },
  about: {
    title: '关于我',
    description: '了解更多',
  },
  timeline: {
    title: '时间线',
    description: '按时间顺序浏览文章',
  },
  links: {
    title: '友情链接',
    description: '朋友们',
  },
  'tags/index': {
    title: '所有标签',
    description: '博客文章的所有标签集合',
  },
  'categories/index': {
    title: '所有分类',
    description: '博客文章的所有分类集合',
  },
  'privacy-policy': {
    title: '隐私政策',
    description: '本站的隐私政策说明',
  },
  'cookies-policy': {
    title: 'Cookies 政策',
    description: '本站的 Cookies 使用政策',
  },
  'copyright-policy': {
    title: '版权协议',
    description: '本站的版权与转载相关协议',
  },
};

const tagsSet = new Set<string>();
const categoriesSet = new Set<string>();

posts.forEach((post) => {
  pages[`posts/${post.data.abbrlink}`] = {
    title: post.data.title,
    description: getPostExcerpt(post) || siteConfig.description,
  };

  if (post.data.category) {
    categoriesSet.add(post.data.category);
  }

  if (post.data.tags) {
    post.data.tags.forEach((tag: string) => tagsSet.add(tag));
  }
});

categoriesSet.forEach((category) => {
  pages[`categories/${category}`] = {
    title: `分类：${category}`,
    description: `浏览【${category}】分类下的所有文章`,
  };
});

tagsSet.forEach((tag) => {
  pages[`tags/${tag}`] = {
    title: `标签：#${tag}`,
    description: `浏览包含【${tag}】标签的所有文章`,
  };
});

export const { getStaticPaths, GET } = await OGImageRoute({
  pages,

  getImageOptions: (_path, page) => ({
    title: page.title,
    description: page.description,

    logo: {
      path: './public/img/icons/icon-512x512.png',
      size: [100, 100],
    },

    bgGradient: [
      [253, 253, 253],
      [241, 245, 249],
    ],

    border: {
      color: [45, 75, 180],
      width: 16,
      side: 'inline-start',
    },

    padding: 80,

    font: {
      title: {
        color: [30, 30, 30],
        size: 68,
        weight: 'Bold',
        lineHeight: 1.2,
      },
      description: {
        color: [113, 118, 126],
        size: 32,
        weight: 'Medium',
        lineHeight: 1.5,
      },
    },

    fonts: ['./public/fonts/NotoSansSC-Medium.ttf', './public/fonts/NotoSansSC-Bold.ttf'],

    cacheDir: './node_modules/.astro-og-canvas',
  }),
});
