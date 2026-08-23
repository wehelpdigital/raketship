#!/usr/bin/env node
/**
 * Creates (or repairs) the demo admin account used by the one-click login
 * button on the sign-in screen.
 *
 * Uses the Supabase Admin API with the secret key, so the account is created
 * already email-confirmed — no inbox round-trip needed.
 *
 *   npm run db:seed-admin
 */
import { readFileSync, existsSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")

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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
const email = process.env.DEMO_ADMIN_EMAIL || "admin@raketship.ph"
const password = process.env.DEMO_ADMIN_PASSWORD

if (!url || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local")
  process.exit(1)
}
if (!password) {
  console.error("Missing DEMO_ADMIN_PASSWORD in .env.local")
  process.exit(1)
}

const headers = {
  apikey: secret,
  Authorization: `Bearer ${secret}`,
  "Content-Type": "application/json",
}

async function findUserByEmail(target) {
  // The admin list endpoint has no server-side email filter, so page through.
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(
      `${url}/auth/v1/admin/users?page=${page}&per_page=200`,
      { headers }
    )
    if (!res.ok) throw new Error(`list users failed: ${res.status} ${await res.text()}`)
    const body = await res.json()
    const users = body.users ?? []
    const hit = users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (hit) return hit
    if (users.length < 200) return null
  }
  return null
}

const existing = await findUserByEmail(email)

let userId
if (existing) {
  userId = existing.id
  const res = await fetch(`${url}/auth/v1/admin/users/${userId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({
      password,
      email_confirm: true,
      user_metadata: { full_name: "RaketShip Admin", is_demo_admin: true },
    }),
  })
  if (!res.ok) {
    console.error(`Failed to update demo admin: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  console.log(`  Updated existing demo admin  ${email}`)
} else {
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "RaketShip Admin", is_demo_admin: true },
    }),
  })
  if (!res.ok) {
    console.error(`Failed to create demo admin: ${res.status} ${await res.text()}`)
    process.exit(1)
  }
  userId = (await res.json()).id
  console.log(`  Created demo admin  ${email}`)
}

// Flag the profile as admin. Requires migrations to have run.
const patch = await fetch(`${url}/rest/v1/profiles?id=eq.${userId}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ is_admin: true, full_name: "RaketShip Admin" }),
})

if (patch.ok) {
  const rows = await patch.json()
  if (rows.length === 0) {
    console.log("  ! No profile row yet — run `npm run db:push` (or paste supabase/setup.sql), then re-run this.")
  } else {
    console.log("  Marked profile as admin.")
  }
} else {
  const text = await patch.text()
  if (text.includes("does not exist") || patch.status === 404) {
    console.log("  ! profiles table not found — apply supabase/setup.sql first, then re-run this script.")
  } else {
    console.log(`  ! Could not flag profile as admin: ${patch.status} ${text}`)
  }
}

console.log(`\n  Demo admin ready:\n    email:    ${email}\n    password: ${password}\n`)
