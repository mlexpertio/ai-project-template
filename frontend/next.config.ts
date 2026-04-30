import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { NextConfig } from "next"

try {
  const parentEnv = resolve(process.cwd(), "..", ".env")
  const lines = readFileSync(parentEnv, "utf-8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (key.startsWith("NEXT_PUBLIC_") && !process.env[key]) {
      process.env[key] = val
    }
  }
} catch {}

const allowedDevOrigins = process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS
  ? process.env.NEXT_PUBLIC_ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
  : []

const nextConfig: NextConfig = {
  allowedDevOrigins,
}

export default nextConfig
