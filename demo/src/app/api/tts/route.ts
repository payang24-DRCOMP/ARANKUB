import { NextResponse } from "next/server";

/**
 * เดโมไม่มีเสียงอ่าน — ระบบจริงเรียกบริการสังเคราะห์เสียงภาษาไทยที่รันในองค์กร
 * คืน 501 เพื่อให้หน้าจอปิดปุ่มเสียงเองอย่างเรียบร้อย แทนที่จะค้างรอ
 */
export async function POST() {
  return NextResponse.json({ error: "เดโมไม่รองรับเสียงอ่าน", demo: true }, { status: 501 });
}
