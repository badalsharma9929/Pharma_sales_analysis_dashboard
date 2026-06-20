import { NextRequest, NextResponse } from "next/server";
import { getHcp } from "@/lib/analytics/hcp";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getHcp(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/hcp] error:", err);
    return NextResponse.json({ error: "Failed to load HCP data" }, { status: 500 });
  }
}
