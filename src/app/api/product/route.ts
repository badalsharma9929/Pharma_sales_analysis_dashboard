import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/lib/analytics/product";
import { parseFilters } from "@/lib/analytics/filters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const filters = parseFilters(req.nextUrl.searchParams);
    const data = await getProduct(filters);
    return NextResponse.json(data);
  } catch (err) {
    console.error("[/api/product] error:", err);
    return NextResponse.json({ error: "Failed to load product data" }, { status: 500 });
  }
}
