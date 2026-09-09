import { NextResponse } from "next/server";
import { demoOverview, demoOpd, demoIpd } from "@/lib/demo-data";

/**
 * เดโม: ระบบจริงอ่านตัวเลขสะสมจาก PostgreSQL ที่ sync มาจาก HosXP
 * และอ่านตัวเลข "ณ ขณะนี้" จาก HosXP สดผ่านบริการ Python
 */
export async function GET() {
  const overview = demoOverview();
  return NextResponse.json({ overview, opd: demoOpd(overview), ipd: demoIpd(overview) });
}
