import { NextResponse } from "next/server";
import { demoFinance } from "@/lib/demo-data";

/** เดโม: ระบบจริงรวมข้อมูลจากผลตรวจสอบ REP, กองทุน สปสช. และ Seamless */
export async function GET() {
  return NextResponse.json(demoFinance());
}
