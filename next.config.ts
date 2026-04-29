import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow HMR from local network IPs (e.g. when accessing from another device on the same network)
  allowedDevOrigins: ['196.220.253.149'],
}

export default nextConfig
