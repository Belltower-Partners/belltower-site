import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The two memo tabs. `tab` is the label on the tab; `order` sets left-to-right position.
const memos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/memos' }),
  schema: z.object({
    order: z.number(),
    tab: z.string(),
  }),
});

export const collections = { memos };
