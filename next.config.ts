import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do not advertise the framework via the `X-Powered-By` response header.
  poweredByHeader: false,
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'images.openfoodfacts.org' },
      { protocol: 'https', hostname: 'static.openfoodfacts.org' },
      { protocol: 'https', hostname: 'world.openfoodfacts.org' },
    ],
  },
  // Security headers applied to all routes.
  // Shape verified against node_modules/next/dist/docs headers.md:
  // headers() is async and returns an array of { source, headers: [{ key, value }] }.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // TODO(security): Add a Content-Security-Policy header once it has been
          // tested end-to-end. A wrong CSP will silently break the app (inline/
          // Next.js runtime scripts, styles, fonts) and outbound calls to
          // Supabase and Resend. When adding it, allowlist the origins this app
          // actually talks to:
          //   - 'self' (first-party app + Next.js assets)
          //   - Supabase project: https://<project-ref>.supabase.co
          //     (REST/Auth/Realtime over https + wss for Realtime websockets)
          //   - Resend: https://api.resend.com (email send) and the Resend
          //     open/click tracking pixel/link domain used for analytics
          //   - Remote image hosts already in images.remotePatterns above
          //     (images.unsplash.com, picsum.photos, *.openfoodfacts.org)
          // Build it incrementally with Content-Security-Policy-Report-Only first,
          // verify nothing breaks, then promote to the enforcing header.
        ],
      },
    ];
  },
};

export default nextConfig;
