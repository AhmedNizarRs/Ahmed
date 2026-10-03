/**
 * Site-wide settings. Change values here, not in components.
 */

/** Gumroad checkout for the flagship Vault. Every "buy" button opens this in a new tab.
 *  Can also be set with the PUBLIC_GUMROAD_VAULT_URL environment variable on Vercel. */
export const GUMROAD_VAULT_URL: string =
  (import.meta.env?.PUBLIC_GUMROAD_VAULT_URL as string | undefined) ||
  'https://kingahmed10.gumroad.com/l/uyxaa';

/** Public address of the site, used for canonical links, sitemap and share cards.
 *  TODO: confirm — replace with the real domain once it is connected on Vercel. */
export const SITE_URL = 'https://rimal-interiors.vercel.app';

export const INSTAGRAM_HANDLE = 'rimalinterior';
export const INSTAGRAM_URL = `https://www.instagram.com/${INSTAGRAM_HANDLE}/`;

export const BRAND = {
  name: 'RIMAL Interiors',
  nameAr: 'رمال للتصميم الداخلي', // TODO: confirm the Arabic brand name
  owner: { en: 'Ahmed Nazar', ar: 'أحمد نزار' }, // TODO: confirm Arabic spelling of the name
};
