import { NextResponse } from "next/server";

/** เดโม: ระบบจริงให้ผู้ดูแลตั้งค่าโมเดลภาษาที่ใช้ได้เองที่หน้า Settings */
export async function GET() {
  return NextResponse.json([
    { id: "demo", name: "โมเดลจำลอง (เดโม)", modelId: "demo", type: "ollama", isDefault: true },
  ]);
}
