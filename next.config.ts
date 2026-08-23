import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // The floating dev badge overlaps the canvas's own floating controls.
  // Compile and runtime errors are still surfaced without it.
  devIndicators: false,
}

export default nextConfig
