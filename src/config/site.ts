export const siteConfig = {
  name: '谐元场域',
  title: '谐元场域',
  description: '大抵是序炁的龙窝',
  url: 'https://www.ordchaos.com',
  icon: '/img/icons/svg.svg',
  license: 'BY-NC-SA',

  author: {
    name: '序炁',
    email: 'orderchaos@ordchaos.com',
  },

  locale: 'zh-CN',
  charset: 'utf-8',

  seo: {
    defaultTitle: '谐元场域',
    titleTemplate: '%s - 谐元场域',
    defaultDescription: '大抵是序炁的龙窝',
    defaultOgImage: '/img/og/index.png',
  },

  rss: {
    title: '谐元场域',
    description: '大抵是序炁的龙窝',
  },

  footer: {
    statusUrl: 'https://status.ordchaos.com',
    icp: {
      enabled: true,
      text: '鄂ICP备2026069779号-1',
    },
    mps: {
      enabled: false,
      text: '鄂公网安备xxxxxxxxxxxxxx号',
    },
  },
} as const;
