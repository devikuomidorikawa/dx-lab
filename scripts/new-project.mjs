import fs from "node:fs"
import path from "node:path"
import readline from "node:readline/promises"
import { stdin as input, stdout as output } from "node:process"

const repoRoot = process.cwd()
const projectDir = path.join(repoRoot, "src", "content", "projects")
const tagFile = path.join(repoRoot, "src", "lib", "projectTags.ts")

function readAllowedTags() {
  const source = fs.readFileSync(tagFile, "utf8")
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1])
}

function getArg(name) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1] : ""
}

function slugify(value) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function yamlString(value) {
  return JSON.stringify(value)
}

async function main() {
  const rl = readline.createInterface({ input, output })
  const allowedTags = readAllowedTags()

  try {
    const title = getArg("title") || (await rl.question("タイトル: "))
    if (!title.trim()) throw new Error("タイトルは必須です。")

    const slugAnswer = getArg("slug") || (await rl.question(`slug [${slugify(title)}]: `))
    const slug = slugify(slugAnswer || title)
    if (!slug) throw new Error("slugを英数字・ハイフンで指定してください。")

    const description = getArg("description") || (await rl.question("説明文: "))
    const tagsAnswer = getArg("tags") || (await rl.question(`タグ（カンマ区切り）\n使用可能: ${allowedTags.join(", ")}\n> `))
    const tags = tagsAnswer
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)

    if (tags.length === 0) throw new Error("タグを1つ以上指定してください。")

    const invalidTags = tags.filter((tag) => !allowedTags.includes(tag))
    if (invalidTags.length > 0) {
      throw new Error(`未登録タグです: ${invalidTags.join(", ")}\nsrc/lib/projectTags.ts に追加するか、既存タグを使用してください。`)
    }

    const filePath = path.join(projectDir, `${slug}.md`)
    if (fs.existsSync(filePath)) throw new Error(`既に存在します: ${filePath}`)

    const date = today()
    const content = `---
title: ${yamlString(title.trim())}
description: ${yamlString(description.trim())}
tags: [${tags.map(yamlString).join(", ")}]
createdAt: "${date}"
updatedAt: "${date}"
status: "draft"
featured: false
highlightUpdated: false
---

## 課題


## 使ったツール


## 実装手順


## 効果


## 注意点


## 今後の改善

`

    fs.writeFileSync(filePath, content, "utf8")
    console.log(`作成しました: ${path.relative(repoRoot, filePath)}`)
    console.log("公開する場合は status を \"published\" に変更してください。")
  } finally {
    rl.close()
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})

