import fs from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()
const projectDir = path.join(repoRoot, "src", "content", "projects")
const exportDir = path.join(repoRoot, "exports")
const noteDir = path.join(exportDir, "note-md")

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function parseValue(value) {
  const trimmed = value.trim()

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return [...trimmed.matchAll(/"([^"]+)"/g)].map((match) => match[1])
  }

  if (trimmed === "true") return true
  if (trimmed === "false") return false
  if (/^\d+$/.test(trimmed)) return Number(trimmed)

  const quoted = trimmed.match(/^"(.*)"$/)
  return quoted ? quoted[1] : trimmed
}

function parseProject(fileName) {
  const filePath = path.join(projectDir, fileName)
  const source = fs.readFileSync(filePath, "utf8")
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/)

  if (!match) throw new Error(`frontmatterが見つかりません: ${fileName}`)

  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const separator = line.indexOf(":")
    if (separator < 0) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1)
    data[key] = parseValue(value)
  }

  return {
    slug: fileName.replace(/\.md$/, ""),
    path: `src/content/projects/${fileName}`,
    title: data.title ?? "",
    description: data.description ?? "",
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? data.createdAt ?? "",
    status: data.status ?? "published",
    featured: Boolean(data.featured),
    highlightUpdated: Boolean(data.highlightUpdated),
    order: data.order ?? "",
    body: match[2].trim(),
  }
}

function csvCell(value) {
  const text = Array.isArray(value) ? value.join("; ") : String(value ?? "")
  return `"${text.replace(/"/g, '""')}"`
}

function toCsv(projects) {
  const columns = ["slug", "title", "description", "tags", "createdAt", "updatedAt", "status", "featured", "highlightUpdated", "order", "path"]
  const rows = projects.map((project) => columns.map((column) => csvCell(project[column])).join(","))
  return `${columns.join(",")}\n${rows.join("\n")}\n`
}

function toNoteMarkdown(project) {
  const tagLine = project.tags.length > 0 ? `\nタグ: ${project.tags.map((tag) => `#${tag.replace(/\s+/g, "_")}`).join(" ")}\n` : ""
  return `# ${project.title}

${project.description}

作成日: ${project.createdAt}
更新日: ${project.updatedAt}
状態: ${project.status}${tagLine}
---

${project.body}
`
}

function main() {
  ensureDir(exportDir)
  ensureDir(noteDir)

  const projects = fs
    .readdirSync(projectDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map(parseProject)

  const jsonProjects = projects.map(({ body, ...project }) => project)
  fs.writeFileSync(path.join(exportDir, "projects.json"), `${JSON.stringify(jsonProjects, null, 2)}\n`, "utf8")
  fs.writeFileSync(path.join(exportDir, "projects.csv"), toCsv(jsonProjects), "utf8")

  for (const project of projects) {
    fs.writeFileSync(path.join(noteDir, `${project.slug}.md`), toNoteMarkdown(project), "utf8")
  }

  console.log(`エクスポートしました: ${path.relative(repoRoot, exportDir)}`)
  console.log(`記事数: ${projects.length}`)
}

main()

