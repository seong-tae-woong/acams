import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://acams-jmi3.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/intro', '/academy'],
      disallow: ['/api/', '/super-admin', '/students', '/classes', '/finance', '/calendar', '/communication', '/analytics', '/settings', '/mobile', '/ingang', '/login'],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
  };
}
