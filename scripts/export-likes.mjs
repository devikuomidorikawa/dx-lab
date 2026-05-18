import fs from "node:fs"
import path from "node:path"
import { spawnSync } from "node:child_process"

const repoRoot = process.cwd()
const exportDir = path.join(repoRoot, "exports")
const outputPath = path.join(exportDir, "likes.json")
const query = `
SELECT
  article_slug AS slug,
  COUNT(*) AS count,
  MIN(created_at) AS firstLikedAt,
  MAX(created_at) AS lastLikedAt
FROM article_likes
GROUP BY article_slug
ORDER BY count DESC, article_slug ASC;
`.trim()

fs.mkdirSync(exportDir, { recursive: true })

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["wrangler", "d1", "execute", "dx-lab-likes", "--remote", "--command", query, "--json"],
  {
    cwd: repoRoot,
    encoding: "utf8",
  },
)

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout)
  process.exit(result.status ?? 1)
}

const payload = JSON.parse(result.stdout)
const rows = payload
  .flatMap((entry) => entry?.results ?? [])
  .map((row) => ({
    slug: row.slug,
    count: Number(row.count ?? 0),
    firstLikedAt: row.firstLikedAt ?? "",
    lastLikedAt: row.lastLikedAt ?? "",
  }))

fs.writeFileSync(outputPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8")
console.log(`いいね数をエクスポートしました: ${path.relative(repoRoot, outputPath)}`)

