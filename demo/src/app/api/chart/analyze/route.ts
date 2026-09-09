import { NextResponse } from "next/server";

/**
 * เดโมไม่รองรับส่วนนี้ — ต้องใช้ ThaiDRG Grouper, OCR หรือโมเดลภาษาที่รันบนเครื่องจริง
 * หน้าจอจะแสดงข้อความบอกผู้ใช้แทนการค้างรอ
 */
export async function POST() {
  return NextResponse.json(
    { error: "ส่วนนี้ใช้ได้เฉพาะระบบที่ติดตั้งจริง (ต้องมี Grouper / OCR / โมเดลภาษา)", demo: true },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json({ predictions: [], demo: true });
}
