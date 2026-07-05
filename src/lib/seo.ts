import { siteConfig } from '@/config/site';

export function getPageTitle(title?: string) {
  if (!title || title == siteConfig.title) {
    return siteConfig.seo.defaultTitle;
  }

  return siteConfig.seo.titleTemplate.replace('%s', title);
}

export function getCanonical(pathname: string) {
  return new URL(pathname, siteConfig.url).toString();
}
