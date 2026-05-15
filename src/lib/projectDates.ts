import { execFileSync } from "node:child_process"
import path from "node:path"

import type { CollectionEntry } from "astro:content"

type ProjectEntry = CollectionEntry<"projects">

const repoRoot = process.cwd()
const projectRoot = path.join(repoRoot, "src", "content", "projects")
const updatedAtCache = new Map<string, string>()

function getProjectFile(project: ProjectEntry) {
  return path.join(projectRoot, `${project.id}.md`)
}

function getGitUpdatedAt(relativePath: string) {
  try {
    const output = execFileSync("git", ["log", "-1", "--format=%cs", "--", relativePath], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim()

    return output || null
  } catch {
    return null
  }
}

export function resolveProjectUpdatedAt(project: ProjectEntry) {
  const projectFile = getProjectFile(project)
  const cacheKey = path.relative(repoRoot, projectFile).replace(/\\/g, "/")
  const cached = updatedAtCache.get(cacheKey)

  if (cached) return cached

  const resolved =
    getGitUpdatedAt(cacheKey) ??
    project.data.updatedAt ??
    project.data.createdAt

  updatedAtCache.set(cacheKey, resolved)
  return resolved
}

export function withResolvedProjectDates<T extends ProjectEntry>(project: T) {
  return {
    ...project,
    data: {
      ...project.data,
      updatedAt: resolveProjectUpdatedAt(project),
    },
  }
}
