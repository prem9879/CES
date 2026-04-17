/** @type {import('next').NextConfig} */
const isStaticExport = process.env.NEXT_STATIC_EXPORT !== 'false'

const nextConfig = {
  reactStrictMode: true,
  // Keep static export as the default, but allow full Next server mode when needed.
  output: isStaticExport ? 'export' : undefined,
  outputFileTracingRoot: __dirname,
  // Disable image optimization for static export
  images: {
    unoptimized: true,
  },
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: '/:path*',
              headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
              ],
            },
          ]
        },
      }),
  // Base path for GitHub Pages (update this to your repo name if needed)
  // basePath: '/ces',
  // Trailing slash for GitHub Pages compatibility
  trailingSlash: true,
}

module.exports = nextConfig
