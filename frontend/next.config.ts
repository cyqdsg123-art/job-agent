import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 生产构建用 standalone 模式，产出独立可运行的 server.js
  output: "standalone",
  // /api/* → 后端。本地开发指向 localhost:8000，Docker 里指向 backend:8000
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination:
          (process.env.BACKEND_URL ?? "http://localhost:8000") + "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
