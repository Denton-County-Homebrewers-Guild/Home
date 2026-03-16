// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import { astroImageTools } from "astro-imagetools";

// @ts-ignore
const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: isProd ? 'https://dchg.org' : undefined,
  base: undefined,
  trailingSlash: 'always',
  integrations: [react(), astroImageTools],
  vite: {
    plugins: [tailwindcss()],
  },
  devToolbar:{ enabled: true }
});
