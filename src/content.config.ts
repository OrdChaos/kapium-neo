import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/posts' }) as any,
  schema: z.object({
    title: z.string(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).default([]),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    category: z.string().optional(),
    abbrlink: z.string(),
    summary: z.string().optional(),
  }),
});

export const collections = { posts };
