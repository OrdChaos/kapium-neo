export const artalkConfig = {
  enabled: false, // 公安备案完成前暂时隐藏评论区，备案后改回 true
  server: 'https://comment.ordchaos.com',
  siteName: '谐元场域',
  adminToken: '',
} as const;

export type ArtalkConfig = typeof artalkConfig;
