// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// @ts-ignore
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: isProd ? 'https://dchg.org' : undefined,
  base: undefined,
  trailingSlash: 'always',
  integrations: [react()],
  devToolbar:{ enabled: true }
});
