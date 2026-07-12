export const artalkConfig = {
  server: 'https://artalk.ordchaos.top',
  siteName: '谐元场域',
  adminToken: '',
} as const;

export type ArtalkConfig = typeof artalkConfig;
