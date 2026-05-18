import fs from "node:fs"
import http from "node:http"
import path from "node:path"
import { spawn } from "node:child_process"

const repoRoot = process.cwd()
const projectDir = path.join(repoRoot, "src", "content", "projects")
const tagFile = path.join(repoRoot, "src", "lib", "projectTags.ts")
const host = "127.0.0.1"
const port = Number(process.env.ADMIN_PORT ?? 8787)
const pidFile = path.join(repoRoot, ".admin-server.pid")
const statuses = new Set(["published", "draft", "archived"])

function json(res, body, status = 200) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(JSON.stringify(body))
}

function text(res, body, status = 200, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = ""
    req.setEncoding("utf8")
    req.on("data", (chunk) => {
      body += chunk
      if (body.length > 2_000_000) {
        reject(new Error("Request body is too large."))
        req.destroy()
      }
    })
    req.on("end", () => resolve(body))
    req.on("error", reject)
  })
}

function safeSlug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function readAllowedTags() {
  const source = fs.readFileSync(tagFile, "utf8")
  return [...source.matchAll(/"([^"]+)"/g)].map((match) => match[1])
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

    data[line.slice(0, separator).trim()] = parseValue(line.slice(separator + 1))
  }

  const slug = fileName.replace(/\.md$/, "")
  return {
    slug,
    fileName,
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

function listProjects() {
  return fs
    .readdirSync(projectDir)
    .filter((fileName) => fileName.endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, "ja"))
    .map(parseProject)
}

function yamlString(value) {
  return JSON.stringify(String(value ?? "").trim())
}

function normalizeProject(input, existingSlug = "") {
  const allowedTags = readAllowedTags()
  const slug = safeSlug(input.slug || existingSlug || input.title)

  if (!slug) throw new Error("記事URL名を入力してください。")
  if (!String(input.title ?? "").trim()) throw new Error("タイトルを入力してください。")
  if (!String(input.description ?? "").trim()) throw new Error("説明文を入力してください。")
  if (!statuses.has(input.status)) throw new Error("状態が不正です。")

  const tags = Array.isArray(input.tags) ? input.tags.filter((tag) => allowedTags.includes(tag)) : []
  if (tags.length === 0) throw new Error("タグを1つ以上選択してください。")

  return {
    slug,
    title: String(input.title).trim(),
    description: String(input.description).trim(),
    tags,
    createdAt: String(input.createdAt || today()).trim(),
    updatedAt: String(input.updatedAt || input.createdAt || today()).trim(),
    status: input.status,
    featured: Boolean(input.featured),
    highlightUpdated: Boolean(input.highlightUpdated),
    order: input.order === "" || input.order === null || input.order === undefined ? "" : Number(input.order),
    body: String(input.body ?? "").trim(),
  }
}

function writeProject(project, previousSlug = "") {
  const oldSlug = safeSlug(previousSlug)
  const filePath = path.join(projectDir, `${project.slug}.md`)
  const oldPath = oldSlug ? path.join(projectDir, `${oldSlug}.md`) : ""

  if (oldSlug && oldSlug !== project.slug && fs.existsSync(filePath)) {
    throw new Error(`同じ記事URL名のファイルが既にあります: ${project.slug}`)
  }

  const orderLine = project.order === "" || Number.isNaN(project.order) ? "" : `order: ${project.order}\n`
  const content = `---
title: ${yamlString(project.title)}
description: ${yamlString(project.description)}
tags: [${project.tags.map(yamlString).join(", ")}]
createdAt: ${yamlString(project.createdAt)}
updatedAt: ${yamlString(project.updatedAt)}
status: ${yamlString(project.status)}
featured: ${project.featured ? "true" : "false"}
highlightUpdated: ${project.highlightUpdated ? "true" : "false"}
${orderLine}---

${project.body}
`

  fs.writeFileSync(filePath, content, "utf8")
  if (oldSlug && oldSlug !== project.slug && fs.existsSync(oldPath)) {
    fs.unlinkSync(oldPath)
  }

  return parseProject(`${project.slug}.md`)
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      shell: process.platform === "win32",
      env: process.env,
    })
    let output = ""
    child.stdout.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.stderr.on("data", (chunk) => {
      output += chunk.toString()
    })
    child.on("close", (code) => resolve({ code, output }))
  })
}

const adminHtml = String.raw`<!doctype html>
<html lang="ja">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>DX Lab 管理画面</title>
    <style>
      :root {
        --bg: #f7f7f5;
        --surface: #ffffff;
        --surface-muted: #eeeeeb;
        --text: #333333;
        --muted: #666666;
        --subtle: #8a8a8a;
        --border: #deded8;
        --accent: #333333;
        --accent-text: #ffffff;
        font-family: system-ui, -apple-system, sans-serif;
        color: var(--text);
        background: var(--bg);
      }

      * { box-sizing: border-box; }
      body { margin: 0; background: var(--bg); }
      button, input, textarea, select { font: inherit; }
      button, select { cursor: pointer; }

      .app {
        display: grid;
        grid-template-columns: 320px minmax(0, 1fr);
        min-height: 100vh;
      }

      .sidebar {
        border-right: 1px solid var(--border);
        background: var(--surface);
        padding: 1rem;
        overflow: auto;
      }

      .main {
        padding: 1.25rem;
        overflow: auto;
      }

      h1 {
        margin: 0 0 0.85rem;
        font-size: 1.25rem;
      }

      .actions {
        display: grid;
        gap: 0.5rem;
        margin-bottom: 1rem;
      }

      .button {
        min-height: 2.4rem;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface-muted);
        color: var(--text);
        padding: 0.45rem 0.7rem;
        text-align: center;
      }

      .button.primary {
        background: var(--accent);
        border-color: var(--accent);
        color: var(--accent-text);
      }

      .button:disabled {
        opacity: 0.55;
        cursor: default;
      }

      .filter-row {
        display: grid;
        grid-template-columns: 1fr 8rem;
        gap: 0.5rem;
        margin-bottom: 0.75rem;
      }

      .input,
      .select,
      .textarea {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface);
        color: var(--text);
        padding: 0.55rem 0.65rem;
      }

      .textarea {
        min-height: 22rem;
        resize: vertical;
        line-height: 1.6;
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      }

      .article-list {
        display: grid;
        gap: 0.45rem;
      }

      .article-button {
        width: 100%;
        border: 1px solid var(--border);
        border-radius: 6px;
        background: var(--surface);
        color: var(--text);
        padding: 0.6rem;
        text-align: left;
      }

      .article-button.active {
        border-color: var(--accent);
        outline: 2px solid var(--accent);
        outline-offset: 1px;
      }

      .article-title {
        display: block;
        font-weight: 700;
        line-height: 1.35;
      }

      .article-meta {
        display: block;
        margin-top: 0.2rem;
        color: var(--subtle);
        font-size: 0.78rem;
      }

      .editor-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        margin-bottom: 1rem;
      }

      .editor-header h2 {
        margin: 0;
        font-size: 1.15rem;
      }

      .form-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.85rem;
      }

      .field.full {
        grid-column: 1 / -1;
      }

      label {
        display: grid;
        gap: 0.28rem;
        color: var(--muted);
        font-size: 0.82rem;
        font-weight: 700;
      }

      .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 0.45rem;
      }

      .check {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 0.25rem 0.55rem;
        background: var(--surface);
        color: var(--text);
        font-size: 0.82rem;
        font-weight: 500;
      }

      .status {
        min-height: 2rem;
        margin-top: 1rem;
        color: var(--muted);
        white-space: pre-wrap;
        font-size: 0.86rem;
      }

      .empty {
        color: var(--muted);
        padding: 2rem 0;
      }

      @media (max-width: 820px) {
        .app { grid-template-columns: 1fr; }
        .sidebar { border-right: 0; border-bottom: 1px solid var(--border); max-height: 45vh; }
        .form-grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <h1>DX Lab 管理</h1>
        <div class="actions">
          <button class="button primary" id="newButton" type="button">新規下書き</button>
          <button class="button" id="exportButton" type="button">記事を書き出す</button>
          <button class="button" id="buildButton" type="button">表示確認</button>
          <button class="button" id="stopButton" type="button">管理画面を止める</button>
        </div>
        <div class="filter-row">
          <input class="input" id="searchInput" type="search" placeholder="記事を検索">
          <select class="select" id="statusFilter">
            <option value="all">すべて</option>
            <option value="published">公開</option>
            <option value="draft">下書き</option>
            <option value="archived">退避</option>
          </select>
        </div>
        <div class="article-list" id="articleList"></div>
      </aside>

      <main class="main">
        <div class="editor-header">
          <h2 id="editorTitle">記事を選択してください</h2>
          <button class="button primary" id="saveButton" type="button" disabled>保存</button>
        </div>
        <form id="editor" hidden>
          <div class="form-grid">
            <label class="field">
              タイトル
              <input class="input" id="titleInput">
            </label>
            <label class="field">
              記事URL名
              <input class="input" id="slugInput">
            </label>
            <label class="field full">
              説明文
              <input class="input" id="descriptionInput">
            </label>
            <label class="field">
              状態
              <select class="select" id="statusInput">
                <option value="published">公開</option>
                <option value="draft">下書き</option>
                <option value="archived">退避</option>
              </select>
            </label>
            <label class="field">
              作成日
              <input class="input" id="createdAtInput" type="date">
            </label>
            <label class="field">
              更新日
              <input class="input" id="updatedAtInput" type="date">
            </label>
            <label class="field">
              おすすめ順
              <input class="input" id="orderInput" type="number" min="0">
            </label>
            <label class="field">
              表示オプション
              <span class="checks">
                <span class="check"><input id="featuredInput" type="checkbox"> おすすめ記事</span>
                <span class="check"><input id="highlightUpdatedInput" type="checkbox"> 更新表示</span>
              </span>
            </label>
            <label class="field full">
              タグ
              <span class="checks" id="tagChecks"></span>
            </label>
            <label class="field full">
              本文
              <textarea class="textarea" id="bodyInput"></textarea>
            </label>
          </div>
        </form>
        <p class="empty" id="emptyMessage">左の記事一覧から編集する記事を選んでください。</p>
        <div class="status" id="statusMessage"></div>
      </main>
    </div>

    <script>
      const statusLabels = { published: "公開", draft: "下書き", archived: "退避" }
      let projects = []
      let tags = []
      let selectedSlug = ""
      let originalSlug = ""

      const nodes = {
        articleList: document.querySelector("#articleList"),
        searchInput: document.querySelector("#searchInput"),
        statusFilter: document.querySelector("#statusFilter"),
        editor: document.querySelector("#editor"),
        emptyMessage: document.querySelector("#emptyMessage"),
        editorTitle: document.querySelector("#editorTitle"),
        saveButton: document.querySelector("#saveButton"),
        newButton: document.querySelector("#newButton"),
        exportButton: document.querySelector("#exportButton"),
        buildButton: document.querySelector("#buildButton"),
        stopButton: document.querySelector("#stopButton"),
        statusMessage: document.querySelector("#statusMessage"),
        tagChecks: document.querySelector("#tagChecks"),
        titleInput: document.querySelector("#titleInput"),
        slugInput: document.querySelector("#slugInput"),
        descriptionInput: document.querySelector("#descriptionInput"),
        statusInput: document.querySelector("#statusInput"),
        createdAtInput: document.querySelector("#createdAtInput"),
        updatedAtInput: document.querySelector("#updatedAtInput"),
        orderInput: document.querySelector("#orderInput"),
        featuredInput: document.querySelector("#featuredInput"),
        highlightUpdatedInput: document.querySelector("#highlightUpdatedInput"),
        bodyInput: document.querySelector("#bodyInput"),
      }

      const setMessage = (message) => {
        nodes.statusMessage.textContent = message
      }

      const requestJson = async (url, options = {}) => {
        const response = await fetch(url, {
          headers: { "Content-Type": "application/json", ...(options.headers || {}) },
          ...options,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "処理に失敗しました。")
        return data
      }

      const slugify = (value) =>
        value
          .normalize("NFKD")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 80)

      const today = () => new Date().toISOString().slice(0, 10)

      const renderTags = (selectedTags = []) => {
        nodes.tagChecks.innerHTML = tags
          .map((tag) => {
            const checked = selectedTags.includes(tag) ? "checked" : ""
            return '<label class="check"><input type="checkbox" value="' + tag + '" ' + checked + '> ' + tag + '</label>'
          })
          .join("")
      }

      const getSelectedTags = () =>
        Array.from(nodes.tagChecks.querySelectorAll("input:checked")).map((input) => input.value)

      const renderList = () => {
        const query = nodes.searchInput.value.trim().toLowerCase()
        const status = nodes.statusFilter.value
        const visible = projects.filter((project) => {
          const matchesStatus = status === "all" || project.status === status
          const haystack = [project.title, project.description, project.slug, project.tags.join(" ")].join(" ").toLowerCase()
          return matchesStatus && (!query || haystack.includes(query))
        })

        nodes.articleList.innerHTML = visible
          .map((project) => {
            const active = project.slug === selectedSlug ? " active" : ""
            return '<button class="article-button' + active + '" type="button" data-slug="' + project.slug + '">' +
              '<span class="article-title">' + project.title + '</span>' +
              '<span class="article-meta">' + statusLabels[project.status] + ' / 更新 ' + project.updatedAt + ' / ' + project.slug + '</span>' +
              '</button>'
          })
          .join("")
      }

      const fillEditor = (project) => {
        selectedSlug = project.slug
        originalSlug = project.slug
        nodes.editor.hidden = false
        nodes.emptyMessage.hidden = true
        nodes.saveButton.disabled = false
        nodes.editorTitle.textContent = project.title || "新規下書き"
        nodes.titleInput.value = project.title || ""
        nodes.slugInput.value = project.slug || ""
        nodes.descriptionInput.value = project.description || ""
        nodes.statusInput.value = project.status || "draft"
        nodes.createdAtInput.value = project.createdAt || today()
        nodes.updatedAtInput.value = project.updatedAt || today()
        nodes.orderInput.value = project.order ?? ""
        nodes.featuredInput.checked = Boolean(project.featured)
        nodes.highlightUpdatedInput.checked = Boolean(project.highlightUpdated)
        nodes.bodyInput.value = project.body || ""
        renderTags(project.tags || [])
        renderList()
      }

      const readEditor = () => ({
        slug: nodes.slugInput.value,
        title: nodes.titleInput.value,
        description: nodes.descriptionInput.value,
        status: nodes.statusInput.value,
        createdAt: nodes.createdAtInput.value,
        updatedAt: nodes.updatedAtInput.value,
        order: nodes.orderInput.value,
        featured: nodes.featuredInput.checked,
        highlightUpdated: nodes.highlightUpdatedInput.checked,
        tags: getSelectedTags(),
        body: nodes.bodyInput.value,
      })

      const load = async () => {
        const data = await requestJson("/api/projects")
        projects = data.projects
        tags = data.tags
        renderTags()
        renderList()
      }

      nodes.articleList.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-slug]")
        if (!button) return
        const project = projects.find((item) => item.slug === button.dataset.slug)
        if (project) fillEditor(project)
      })

      nodes.searchInput.addEventListener("input", renderList)
      nodes.statusFilter.addEventListener("change", renderList)

      nodes.titleInput.addEventListener("input", () => {
        nodes.editorTitle.textContent = nodes.titleInput.value || "新規下書き"
        if (!originalSlug) nodes.slugInput.value = slugify(nodes.titleInput.value)
      })

      nodes.newButton.addEventListener("click", () => {
        const date = today()
        fillEditor({
          slug: "",
          title: "",
          description: "",
          tags: [],
          createdAt: date,
          updatedAt: date,
          status: "draft",
          featured: false,
          highlightUpdated: false,
          order: "",
          body: "## 課題\n\n\n## 使ったツール\n\n\n## 実装手順\n\n\n## 効果\n\n\n## 注意点\n\n\n## 今後の改善\n",
        })
        selectedSlug = ""
        originalSlug = ""
        nodes.slugInput.focus()
      })

      nodes.saveButton.addEventListener("click", async () => {
        try {
          nodes.saveButton.disabled = true
          setMessage("保存しています...")
          const project = await requestJson("/api/projects/" + encodeURIComponent(originalSlug || nodes.slugInput.value), {
            method: "POST",
            body: JSON.stringify(readEditor()),
          })
          await load()
          fillEditor(project)
          setMessage("保存しました。公開ページへ反映するには、通常どおりコミットとプッシュが必要です。")
        } catch (error) {
          setMessage(error.message)
        } finally {
          nodes.saveButton.disabled = false
        }
      })

      nodes.exportButton.addEventListener("click", async () => {
        try {
          setMessage("記事を書き出しています...")
          const result = await requestJson("/api/export-content", { method: "POST", body: "{}" })
          setMessage(result.output || "書き出しました。")
        } catch (error) {
          setMessage(error.message)
        }
      })

      nodes.buildButton.addEventListener("click", async () => {
        try {
          setMessage("表示確認を実行しています...")
          const result = await requestJson("/api/build", { method: "POST", body: "{}" })
          setMessage(result.output || "表示確認が完了しました。")
        } catch (error) {
          setMessage(error.message)
        }
      })

      nodes.stopButton.addEventListener("click", async () => {
        if (!confirm("管理画面を停止します。よろしいですか？")) return

        try {
          setMessage("管理画面を停止しています...")
          await requestJson("/api/shutdown", { method: "POST", body: "{}" })
          setMessage("管理画面を停止しました。このタブは閉じてください。")
        } catch (error) {
          setMessage(error.message)
        }
      })

      load().catch((error) => setMessage(error.message))
    </script>
  </body>
</html>`

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/projects") {
    json(res, {
      projects: listProjects(),
      tags: readAllowedTags(),
    })
    return
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/projects/")) {
    const currentSlug = decodeURIComponent(url.pathname.replace("/api/projects/", ""))
    const body = JSON.parse(await readBody(req))
    const project = normalizeProject(body, currentSlug)
    json(res, writeProject(project, currentSlug))
    return
  }

  if (req.method === "POST" && url.pathname === "/api/export-content") {
    const result = await runCommand("npm", ["run", "export:content"])
    json(res, result, result.code === 0 ? 200 : 500)
    return
  }

  if (req.method === "POST" && url.pathname === "/api/build") {
    const result = await runCommand("npm", ["run", "build"])
    json(res, result, result.code === 0 ? 200 : 500)
    return
  }

  if (req.method === "POST" && url.pathname === "/api/shutdown") {
    json(res, { ok: true, message: "管理画面を停止します。" })
    setTimeout(() => {
      server.close(() => process.exit(0))
    }, 100)
    return
  }

  json(res, { error: "Not found." }, 404)
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${host}:${port}`)

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url)
      return
    }

    if (req.method === "GET" && url.pathname === "/") {
      text(res, adminHtml, 200, "text/html; charset=utf-8")
      return
    }

    json(res, { error: "Not found." }, 404)
  } catch (error) {
    json(res, { error: error instanceof Error ? error.message : String(error) }, 500)
  }
})

function cleanupPidFile() {
  try {
    if (fs.existsSync(pidFile) && fs.readFileSync(pidFile, "utf8").trim() === String(process.pid)) {
      fs.unlinkSync(pidFile)
    }
  } catch {
    // ignore cleanup failures
  }
}

process.on("exit", cleanupPidFile)
process.on("SIGINT", () => process.exit(0))
process.on("SIGTERM", () => process.exit(0))

server.listen(port, host, () => {
  fs.writeFileSync(pidFile, String(process.pid), "utf8")
  console.log(`DX Lab 管理画面: http://${host}:${port}/`)
})
