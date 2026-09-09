import { NextResponse } from "next/server";

/** เดโม: ยอดกองทุนย่อย (Telemedicine / ส่งยาที่บ้าน) — ระบบจริงอ่านจากไฟล์ REP ที่นำเข้า */
export async function GET(req: Request) {
  const fund = new URL(req.url).searchParams.get("fund") ?? "";
  const totals =
    fund === "TELEMED"
      ? { hosxpPrimary: 1_842, repCases: 1_804, repAmount: 1_104_000, gap: 38 }
      : { hosxpPrimary: 1_496, repCases: 1_441, repAmount: 448_800, gap: 55 };
  return NextResponse.json({ totals });
}
