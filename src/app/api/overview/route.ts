import { NextRequest, NextResponse } from "next/server";
import { getOverview } from "@/lib/analytics/overview";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getOverview(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/overview] error:", err);
    return NextResponse.json({ error: "Failed to load overview" }, { status: 500 });
  }
}
