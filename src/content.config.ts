import { defineCollection, z } from "astro:content"
import { glob } from "astro/loaders"
import { PROJECT_TAGS } from "./lib/projectTags"

const DATE_FORMAT = /^\d{4}-\d{2}-\d{2}$/
const validTagSet = new Set<string>(PROJECT_TAGS)
const projectTag = z.string().refine((tag) => validTagSet.has(tag), {
  message: "未登録のタグです。src/lib/projectTags.ts に追加するか、既存タグを使用してください。",
})

const projects = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(projectTag),
    createdAt: z.string().regex(DATE_FORMAT, "YYYY-MM-DD 形式で入力してください"),
    updatedAt: z.string().regex(DATE_FORMAT, "YYYY-MM-DD 形式で入力してください").optional(),
    status: z.enum(["published", "draft", "archived"]).default("published"),
    featured: z.boolean().default(false),
    highlightUpdated: z.boolean().default(false),
    order: z.number().optional(),
  }),
})

export const collections = { projects }
