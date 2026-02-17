// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

// @ts-ignore
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: isProd ? 'https://dchg.org' : undefined,
  base: undefined,
  trailingSlash: 'always',
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  devToolbar:{ enabled: true }
});
