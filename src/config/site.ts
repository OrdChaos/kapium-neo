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
    startDate: '2022-01-01T00:00:00+08:00',
  },
} as const;
