export function getOgImageUrl(site: URL, path: string) {
  return new URL(`/og/${path}.png`, site).toString();
}
