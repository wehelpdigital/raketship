#!/usr/bin/env node
/**
 * Applies every SQL file in supabase/migrations (lexical order) to the project
 * database.
 *
 * Requires a direct Postgres connection string, because Supabase's REST API
 * cannot execute DDL. Get it from:
 *   Dashboard -> Project Settings -> Database -> Connection string -> URI
 *
 * Then either put it in .env.local as SUPABASE_DB_URL=..., or pass it inline:
 *   SUPABASE_DB_URL="postgresql://..." npm run db:push
 */
import { readFileSync, readdirSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import postgres from "postgres"

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

const url = process.env.SUPABASE_DB_URL
if (!url) {
  console.error(
    [
      "",
      "  SUPABASE_DB_URL is not set.",
      "",
      "  Supabase's REST API cannot run DDL, so migrations need a direct",
      "  Postgres connection. Grab the URI from:",
      "    Dashboard -> Project Settings -> Database -> Connection string",
      "",
      "  Add it to .env.local:",
      "    SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@<host>:5432/postgres",
      "",
      "  Alternative with no password needed: open supabase/setup.sql and paste",
      "  it into the Supabase SQL Editor.",
      "",
    ].join("\n")
  )
  process.exit(1)
}

const dir = join(root, "supabase", "migrations")
const files = readdirSync(dir)
  .filter((f) => f.endsWith(".sql"))
  .sort()

if (files.length === 0) {
  console.error("No migrations found in supabase/migrations")
  process.exit(1)
}

const sql = postgres(url, {
  max: 1,
  // Supabase requires TLS; its pooler cert is not in Node's default store.
  ssl: { rejectUnauthorized: false },
  onnotice: () => {},
})

let failed = false
try {
  for (const file of files) {
    const body = readFileSync(join(dir, file), "utf8")
    process.stdout.write(`  applying ${file} ... `)
    try {
      await sql.unsafe(body)
      console.log("ok")
    } catch (err) {
      console.log("FAILED")
      console.error(`\n  ${err.message}\n`)
      failed = true
      break
    }
  }
} finally {
  await sql.end({ timeout: 5 })
}

if (failed) process.exit(1)
console.log("\n  Database is up to date.\n")
