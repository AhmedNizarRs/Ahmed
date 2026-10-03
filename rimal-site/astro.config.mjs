// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config.ts';

export default defineConfig({
  site: SITE_URL,
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      i18n: { defaultLocale: 'ar', locales: { ar: 'ar', en: 'en' } },
    }),
  ],
  build: { inlineStylesheets: 'always' },
  prefetch: false,
});
