import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// The memo tabs. `tab` is the label on the tab; `order` sets left-to-right position.
// `cases: true` shows the case studies below that tab's text.
const memos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/memos' }),
  schema: z.object({
    order: z.number(),
    tab: z.string(),
    cases: z.boolean().default(false),
  }),
});

// Case studies on the "Our clients" tab. The body is what opens: the client's quote when `quote: true`,
// otherwise our own description. `name` and `title` show while closed; a case without them shows `subtitle`.
const cases = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/cases' }),
  schema: z.object({
    order: z.number(),
    label: z.string(),
    heading: z.string(),
    name: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    bodyLabel: z.string(),
    quote: z.boolean().default(false),
    // `draft: true` keeps a case study off the page while it is being finalized.
    draft: z.boolean().default(false),
  }),
});

export const collections = { memos, cases };
