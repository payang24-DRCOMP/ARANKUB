import { NextResponse } from "next/server";

/**
 * เดโม: ระบบจริงยิง SQL ไป HosXP สดเพื่อดูสถานะคิวแต่ละจุดบริการ ณ ขณะนั้น
 * เดโมไม่มี HIS จึงคืนค่าว่างพร้อมธง demo ให้หน้าจอรู้ว่าไม่ใช่ข้อมูลจริง
 */
export async function GET() {
  return NextResponse.json({ services: [], demo: true });
}
