#!/usr/bin/env node
/**
 * Applies every SQL file in supabase/migrations (lexical order) to the project
 * database.
 *
 * Two ways to authenticate, tried in this order:
 *
 *   1. SUPABASE_ACCESS_TOKEN  — a personal access token (sbp_...) from
 *      https://supabase.com/dashboard/account/tokens. Runs the SQL through the
 *      Management API, so no database password is needed. This is also the
 *      token the Supabase MCP server uses.
 *
 *   2. SUPABASE_DB_URL — a direct Postgres URI from
 *      Dashboard -> Project Settings -> Database -> Connection string.
 *
 * Either can live in .env.local or be passed inline.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

/** Minimal .env.local reader — avoids adding a dotenv dependency. */
function loadEnvLocal() {
  const file = join(root, ".env.local")
  if (!existsSync(file)) return
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith("#")) continue
    const eq = line.indexOf("=")
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = value
  }
}

loadEnvLocal()

const dir = join(root, "supabase", "migrations")
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

if (files.length === 0) {
  console.error("No migrations found in supabase/migrations")
  process.exit(1)
}

/** Derive the project ref from the Supabase URL. */
function projectRef() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
  const m = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/i)
  return m?.[1] ?? null
}

async function applyViaManagementApi(token) {
  const ref = projectRef()
  if (!ref) {
    console.error("Could not read the project ref from NEXT_PUBLIC_SUPABASE_URL")
    process.exit(1)
  }
  const endpoint = `https://api.supabase.com/v1/projects/${ref}/database/query`
  console.log(`\n  Applying via Management API (project ${ref})\n`)

  for (const file of files) {
    const body = readFileSync(join(dir, file), "utf8")
    process.stdout.write(`  ${file} ... `)
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: body }),
    })
    if (!res.ok) {
      console.log("FAILED")
      console.error(`\n  HTTP ${res.status}\n  ${await res.text()}\n`)
      process.exit(1)
    }
    console.log("ok")
  }
}

async function applyViaPostgres(url) {
  const { default: postgres } = await import("postgres")
  const sql = postgres(url, {
    max: 1,
    ssl: { rejectUnauthorized: false },
    onnotice: () => {},
  })
  console.log("\n  Applying via direct Postgres connection\n")
  try {
    for (const file of files) {
      const body = readFileSync(join(dir, file), "utf8")
      process.stdout.write(`  ${file} ... `)
      try {
        await sql.unsafe(body)
        console.log("ok")
      } catch (err) {
        console.log("FAILED")
        console.error(`\n  ${err.message}\n`)
        process.exit(1)
      }
    }
  } finally {
    await sql.end({ timeout: 5 })
  }
}

const token = process.env.SUPABASE_ACCESS_TOKEN
const dbUrl = process.env.SUPABASE_DB_URL

if (token) {
  await applyViaManagementApi(token)
} else if (dbUrl) {
  await applyViaPostgres(dbUrl)
} else {
  console.error(
    [
      "",
      "  No database credential found.",
      "",
      "  Set ONE of these in .env.local:",
      "",
      "    SUPABASE_ACCESS_TOKEN=sbp_...        (recommended — no DB password,",
      "                                          and the Supabase MCP uses it too)",
      "    SUPABASE_DB_URL=postgresql://...     (direct connection)",
      "",
      "  Or paste supabase/setup.sql into the Supabase SQL Editor.",
      "",
    ].join("\n")
  )
  process.exit(1)
}

console.log("\n  Database is up to date.\n")
