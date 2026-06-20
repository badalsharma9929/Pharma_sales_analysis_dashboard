import { NextRequest, NextResponse } from "next/server";
import { getSales } from "@/lib/analytics/sales";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getSales(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/sales] error:", err);
    return NextResponse.json({ error: "Failed to load sales" }, { status: 500 });
  }
}
