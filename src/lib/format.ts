/**
 * src/lib/format.ts — Indian currency, date, and percent formatters.
 *
 * Conventions
 * -----------
 * - Currency: ₹X.XX Cr for amounts ≥ 1 Cr (10^7), ₹X.XX L for amounts ≥ 1 L (10^5),
 *   else ₹X,XXX with Indian digit grouping (1,00,000 not 100,000).
 * - Date: DD-MMM-YYYY (e.g., 05-Jan-2024).
 * - Percent: XX.X% with one decimal.
 */

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format an integer (or float) INR amount as Indian currency.
 * - ≥ 1 Cr (10,000,000) → "₹X.XX Cr"
 * - ≥ 1 L (100,000)     → "₹X.XX L"
 * - else                → "₹X,XXX" with Indian grouping
 */
export function formatINR(value: number): string {
  if (value == null || isNaN(value)) return "₹0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1e7) {
    return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  }
  if (abs >= 1e5) {
    return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  }
  return `${sign}₹${indianGrouping(Math.round(abs))}`;
}

/** Indian digit grouping: 1,00,000 instead of 100,000. */
export function indianGrouping(n: number): string {
  const s = String(Math.abs(n));
  if (s.length <= 3) return (n < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3);
  // Group rest in pairs from right
  const grouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + grouped + "," + last3;
}

/** Format an ISO date string (YYYY-MM-DD) as DD-MMM-YYYY. */
export function formatDate(iso: string | Date | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const mon = MONTH_ABBR[d.getUTCMonth()];
  return `${day}-${mon}-${d.getUTCFullYear()}`;
}

/** Format a fraction or percent value as XX.X%. Accepts either 0.85 (→ "85.0%") or 85 (→ "85.0%"). */
export function formatPct(value: number, alreadyPercent = false): string {
  if (value == null || isNaN(value)) return "0.0%";
  const v = alreadyPercent ? value : value * 100;
  return `${v.toFixed(1)}%`;
}

/** Format YYYY-MM as "Mon YYYY" (e.g., 2024-01 → "Jan 2024"). */
export function formatMonth(monKey: string): string {
  const [y, m] = monKey.split("-").map(Number);
  if (!y || !m) return monKey;
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

/** Compact number formatting for axes (e.g., 1200 → "1.2K", 1500000 → "1.5M"). */
export function formatCompact(n: number): string {
  if (n == null || isNaN(n)) return "0";
  const abs = Math.abs(n);
  if (abs >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}
