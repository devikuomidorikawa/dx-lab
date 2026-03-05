import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    createdAt: z.string().regex(DATE_FORMAT, "YYYY-MM-DD形式で入力してください"),
    updatedAt: z.string().regex(DATE_FORMAT, "YYYY-MM-DD形式で入力してください"),
    status: z.enum(["published", "draft"]).default("published"),
    order: z.number().optional(),
  }),
})

export const collections = { projects }
