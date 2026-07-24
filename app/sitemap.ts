import type { MetadataRoute } from 'next';

const BASE_URL = 'https://swingz.cloud';

const PUBLIC_ROUTES = [
  '',
  '/about',
  '/contact',
  '/impressum',
  '/datenschutz',
  '/terms',
  '/support',
  '/trial-training',
  '/login',
  '/register',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
  }));
}
