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

// Client quotes. The body of each file is the quote itself.
// Exactly one should have `lead: true`; it is set large above the others.
const testimonials = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/testimonials' }),
  schema: z.object({
    order: z.number(),
    lead: z.boolean().default(false),
    name: z.string(),
    title: z.string(),
    firm: z.string(),
  }),
});

export const collections = { memos, testimonials };
