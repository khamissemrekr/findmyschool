import { NextResponse } from "next/server";
import { getCities } from "@/lib/schools";

export async function GET() {
  return NextResponse.json({ cities: getCities() });
}
