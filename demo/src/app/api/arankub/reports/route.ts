import { NextResponse } from "next/server";
import { demoReports } from "@/lib/demo-data";

export async function GET() {
  return NextResponse.json(demoReports());
}
