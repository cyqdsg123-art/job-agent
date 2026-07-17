import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 开发环境把 /api/* 代理到 FastAPI 后端，避免跨域
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
