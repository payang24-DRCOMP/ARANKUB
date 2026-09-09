import { NextResponse } from "next/server";
import { demoCollections } from "@/lib/demo-data";

/** เดโม: ระบบจริงอ่านรายการ collection จาก Qdrant ที่รันบนเครื่องของโรงพยาบาล */
export async function GET() {
  return NextResponse.json(demoCollections());
}

export async function POST() {
  return NextResponse.json({ error: "เดโมไม่รองรับการสร้างคลังความรู้", demo: true }, { status: 501 });
}

export async function DELETE() {
  return NextResponse.json({ error: "เดโมไม่รองรับการลบคลังความรู้", demo: true }, { status: 501 });
}
