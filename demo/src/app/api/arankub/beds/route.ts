import { NextResponse } from "next/server";
import { demoOverview } from "@/lib/demo-data";

export async function GET() {
  return NextResponse.json({ wards: demoOverview().wardsTop });
}

/** เดโมไม่บันทึกการแก้ไข — ระบบจริงเก็บจำนวนเตียงต่อวอร์ดไว้ในฐานข้อมูล */
export async function PUT() {
  return NextResponse.json({ ok: true, demo: true });
}
