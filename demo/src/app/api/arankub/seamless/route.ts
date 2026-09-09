import { NextResponse } from "next/server";
import { demoFinance } from "@/lib/demo-data";

export async function GET() {
  return NextResponse.json({ items: demoFinance().seamless });
}
