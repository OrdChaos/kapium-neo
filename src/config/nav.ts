export type NavChildItem = { label: string; href: string };

export type NavItem = {
  label: string;
  href?: string;
  children?: readonly NavChildItem[];
};

export const nav: NavItem[] = [
  { label: '首页', href: '/' },
  {
    label: '归档',
    children: [
      { label: '分类', href: '/categories/' },
      { label: '标签', href: '/tags/' },
      { label: '时间线', href: '/timeline/' },
    ],
  },
  {
    label: '朋友们',
    children: [
      { label: '友链', href: '/links/' },
      { label: '开往', href: 'https://www.travellings.cn/go.html' },
    ],
  },
  { label: '关于', href: '/about/' },
];
