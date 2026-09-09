import { NextRequest, NextResponse } from "next/server";
import { demoIpdRecords } from "@/lib/demo-data";

/** เดโม: ระบบจริงอ่านจากตารางที่ sync มาจาก an_stat / ipt / iptdiag ของ HosXP */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const page = Number(sp.get("page") ?? 1);
  const limit = Number(sp.get("limit") ?? 20);
  const all = demoIpdRecords(120);
  const start = (page - 1) * limit;
  return NextResponse.json({
    records: all.slice(start, start + limit),
    total: all.length,
    page,
    limit,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body.action === "wards") {
    const wards = [...new Set(demoIpdRecords(120).map((r) => r.wardName))];
    return NextResponse.json({ wards });
  }
  return NextResponse.json({ error: "เดโมไม่รองรับคำสั่งนี้", demo: true }, { status: 400 });
}
