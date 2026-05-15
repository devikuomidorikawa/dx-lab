export interface Env {
  DB: {
    prepare: (query: string) => {
      bind: (...values: unknown[]) => {
        first: <T>() => Promise<T | null>
        run: () => Promise<unknown>
      }
    }
  }
  TURNSTILE_SECRET_KEY: string
  ALLOWED_ORIGINS: string
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
}

function getAllowedOrigin(origin: string | null, env: Env) {
  if (!origin) return null

  const allowedOrigins = env.ALLOWED_ORIGINS.split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return allowedOrigins.includes(origin) ? origin : null
}

function createCorsHeaders(origin: string | null, env: Env) {
  const allowedOrigin = getAllowedOrigin(origin, env)

  return allowedOrigin
    ? {
        "Access-Control-Allow-Origin": allowedOrigin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        Vary: "Origin",
      }
    : { Vary: "Origin" }
}

function jsonResponse(body: unknown, init: ResponseInit = {}, origin: string | null = null, env?: Env) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...(env ? createCorsHeaders(origin, env) : {}),
      ...(init.headers ?? {}),
    },
  })
}

function badRequest(error: string, origin: string | null, env: Env, status = 400) {
  return jsonResponse({ error }, { status }, origin, env)
}

function parseArticleSlug(url: URL) {
  const match = url.pathname.match(/^\/likes\/([^/]+)$/)
  if (!match) return null

  const slug = decodeURIComponent(match[1])
  return /^[a-z0-9-]{1,120}$/i.test(slug) ? slug : null
}

async function getLikeState(env: Env, articleSlug: string, visitorId?: string) {
  const countRow = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM article_likes WHERE article_slug = ?1",
  )
    .bind(articleSlug)
    .first<{ count: number }>()

  let liked = false

  if (visitorId) {
    const likedRow = await env.DB.prepare(
      "SELECT 1 AS liked FROM article_likes WHERE article_slug = ?1 AND visitor_id = ?2 LIMIT 1",
    )
      .bind(articleSlug, visitorId)
      .first<{ liked: number }>()

    liked = Boolean(likedRow?.liked)
  }

  return {
    count: Number(countRow?.count ?? 0),
    liked,
  }
}

async function verifyTurnstileToken(env: Env, token: string, remoteIp: string | null) {
  const formData = new FormData()
  formData.append("secret", env.TURNSTILE_SECRET_KEY)
  formData.append("response", token)

  if (remoteIp) formData.append("remoteip", remoteIp)

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: formData,
  })

  if (!response.ok) return false

  const result = await response.json<{ success?: boolean }>()
  return Boolean(result.success)
}

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get("Origin")

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: createCorsHeaders(origin, env),
      })
    }

    const articleSlug = parseArticleSlug(url)

    if (!articleSlug) {
      return badRequest("Invalid article slug.", origin, env, 404)
    }

    if (request.method === "GET") {
      const visitorId = url.searchParams.get("visitorId")?.trim()
      const state = await getLikeState(env, articleSlug, visitorId)
      return jsonResponse(state, { status: 200 }, origin, env)
    }

    if (request.method !== "POST") {
      return badRequest("Method not allowed.", origin, env, 405)
    }

    if (!getAllowedOrigin(origin, env)) {
      return badRequest("Origin not allowed.", origin, env, 403)
    }

    let payload: { visitorId?: string; turnstileToken?: string } | null = null

    try {
      payload = await request.json()
    } catch {
      return badRequest("Invalid request body.", origin, env)
    }

    const visitorId = payload?.visitorId?.trim()
    const turnstileToken = payload?.turnstileToken?.trim()

    if (!visitorId || visitorId.length > 120) {
      return badRequest("Invalid visitor id.", origin, env)
    }

    if (!turnstileToken) {
      return badRequest("Missing verification token.", origin, env)
    }

    const verified = await verifyTurnstileToken(env, turnstileToken, request.headers.get("CF-Connecting-IP"))

    if (!verified) {
      return badRequest("Verification failed.", origin, env, 403)
    }

    let status = "liked"

    try {
      await env.DB.prepare(
        "INSERT INTO article_likes (article_slug, visitor_id) VALUES (?1, ?2)",
      )
        .bind(articleSlug, visitorId)
        .run()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!message.toLowerCase().includes("unique")) {
        return badRequest("Failed to register like.", origin, env, 500)
      }

      status = "already-liked"
    }

    const state = await getLikeState(env, articleSlug, visitorId)

    return jsonResponse(
      {
        ...state,
        status,
      },
      { status: 200 },
      origin,
      env,
    )
  },
}

export default worker
