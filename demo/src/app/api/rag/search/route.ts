import { NextResponse } from "next/server";

/**
 * ค้นคลังความรู้ (เดโม) — คืนผลตัวอย่างคงที่
 * ระบบจริงแปลงคำค้นเป็นเวกเตอร์แล้วค้นใน Qdrant พร้อมจัดอันดับผลลัพธ์ใหม่
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const q = String(body.query ?? "");
  return NextResponse.json([
    {
      content:
        `ตัวอย่างผลการค้นหาสำหรับ "${q}" — ระบบจริงจะคืนข้อความจริงจากเอกสารที่นำเข้าไว้ ` +
        "พร้อมชื่อไฟล์และหน้าที่พบ เพื่อให้ผู้ใช้ตรวจสอบที่มาได้",
      score: 0.87,
      payload: { filename: "ตัวอย่างเอกสาร.pdf", page: 12 },
    },
  ]);
}
