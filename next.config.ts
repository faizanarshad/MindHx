import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [new URL("https://images.unsplash.com/**")],
  },
  // Proxies same-origin "/api/*" calls (see src/app/lib/api.ts) to the
  // FastAPI backend running alongside this server in the same container.
  // Keeps the browser talking to one origin only, so there's no CORS to
  // configure. Override API_INTERNAL_URL if the backend lives elsewhere
  // (e.g. a different container/host reachable over the network).
  async rewrites() {
    const target = process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
    return [{ source: "/api/:path*", destination: `${target}/:path*` }];
  },
};

export default nextConfig;
