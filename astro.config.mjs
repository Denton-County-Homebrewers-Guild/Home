// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: isProd ? 'https://username.github.io' : undefined,
  base: isProd ? '/Home' : undefined,
  trailingSlash: 'always',
  integrations: [react()],
});