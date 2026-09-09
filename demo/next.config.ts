import type { NextConfig } from "next";

const HOSPITAL_API_URL =
  process.env.HOSPITAL_API_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // rag-chat stream ใช้เวลาเกิน 30s (ค่า default) — ขยายเป็น 5 นาที
    proxyTimeout: 300_000,
  },
  async rewrites() {
    return [
      // Hospital Dashboard backend (FastAPI) — เมนู สปสช / วิเคราะห์ / ตรวจสอบ / AI
      {
        source: "/api/v1/:path*",
        destination: `${HOSPITAL_API_URL}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
