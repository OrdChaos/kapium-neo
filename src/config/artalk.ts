export const artalkConfig = {
  server: 'https://comment.ordchaos.com',
  siteName: '谐元场域',
  adminToken: '',
} as const;

export type ArtalkConfig = typeof artalkConfig;
