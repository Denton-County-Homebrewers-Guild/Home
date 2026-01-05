// @ts-check
import { defineConfig } from 'astro/config';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  site: isProd ? 'https://username.github.io' : undefined,
  base: isProd ? '/my-site' : undefined,
});

