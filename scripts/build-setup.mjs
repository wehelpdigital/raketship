#!/usr/bin/env node
/**
 * Rebuilds supabase/setup.sql from supabase/migrations.
 *
 * setup.sql is the path for anyone without a database password: paste the whole
 * file into the Supabase SQL Editor. That makes it a SECOND source of truth for
 * the schema, and a second source of truth drifts. It drifted twice in one
 * afternoon — most recently leaving out the migration that adds
 * cancel_notice_hours, which every calendar insert names unconditionally, so a
 * paste-provisioned project could not create a calendar at all.
 *
 *   node scripts/build-setup.mjs           rewrite setup.sql
 *   node scripts/build-setup.mjs --check   fail if it is stale, change nothing
 *
 * The check runs as part of `npm run verify`, so a migration cannot be added
 * without setup.sql following it.
 */

import { readFileSync, readdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const MIGRATIONS = "supabase/migrations"
const TARGET = "supabase/setup.sql"

const HEADER = `-- ============================================================================
-- RaketShip — ONE-PASTE SETUP
-- Paste into the Supabase SQL Editor and Run. Safe to re-run.
--
-- GENERATED from supabase/migrations by scripts/build-setup.mjs. Do not edit by
-- hand: \`npm run verify\` fails when this file and the migrations disagree.
-- ============================================================================

`

function build() {
  const files = readdirSync(MIGRATIONS)
    .filter((name) => name.endsWith(".sql"))
    .sort()

  if (files.length === 0) {
    throw new Error(`no migrations found in ${MIGRATIONS}`)
  }

  const body = files
    .map((name) => readFileSync(join(MIGRATIONS, name), "utf8"))
    .join("\n")

  return { text: HEADER + body, files }
}

const { text, files } = build()
const checking = process.argv.includes("--check")

let current = null
try {
  current = readFileSync(TARGET, "utf8")
} catch {
  current = null
}

if (checking) {
  if (current === text) {
    console.log(`setup.sql is current (${files.length} migrations)`)
    process.exit(0)
  }

  const missing = files.filter(
    (name) =>
      !readFileSync(join(MIGRATIONS, name), "utf8")
        .split("\n")
        .every((line) => current?.includes(line) ?? false)
  )

  console.error(
    `\nsetup.sql is out of date with supabase/migrations.\n` +
      (missing.length > 0
        ? `  not fully present: ${missing.join(", ")}\n`
        : "  the content differs\n") +
      `\nRun: npm run db:setup\n`
  )
  process.exit(1)
}

writeFileSync(TARGET, text)
console.log(`wrote ${TARGET} from ${files.length} migrations`)
