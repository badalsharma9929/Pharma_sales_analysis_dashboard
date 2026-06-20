import { NextRequest, NextResponse } from "next/server";
import { getFieldForce } from "@/lib/analytics/field-force";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getFieldForce(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/field-force] error:", err);
    return NextResponse.json({ error: "Failed to load field force data" }, { status: 500 });
  }
}
