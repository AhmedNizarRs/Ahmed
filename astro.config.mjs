import { defineConfig } from 'astro/config';

// Set `site` to the live domain once it is known, e.g. 'https://rimalinteriors.com'.
// It is used for canonical language links and the social preview image.
export default defineConfig({
  site: undefined,
  trailingSlash: 'ignore',
});
