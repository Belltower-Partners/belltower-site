// @ts-check
import { defineConfig } from 'astro/config';

// A static site: `npm run build` writes plain HTML, CSS and JS to ./dist,
// which Cloudflare serves as-is (see wrangler.jsonc).
export default defineConfig({
  output: 'static',
  site: 'https://gobelltower.com',
});
