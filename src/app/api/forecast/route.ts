import { NextRequest, NextResponse } from "next/server";
import { getForecast } from "@/lib/analytics/forecast";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getForecast(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/forecast] error:", err);
    return NextResponse.json({ error: "Failed to load forecast" }, { status: 500 });
  }
}
