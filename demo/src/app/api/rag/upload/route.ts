import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "เดโมไม่รองรับการนำเข้าเอกสาร — ต้องมี Qdrant และบริการอ่านเอกสาร", demo: true },
    { status: 501 }
  );
}
