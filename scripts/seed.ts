/**
 * scripts/seed.ts
 *
 * Streams the 7 CSVs from /home/z/my-project/data/ into the SQLite database
 * via Prisma createMany. Batches large tables in chunks of 2000 rows to
 * avoid memory issues.
 *
 * Note: SQLite does not support Prisma's skipDuplicates option, so we
 * deleteMany() before each table insert to ensure a clean state.
 *
 * Run:  bun run scripts/seed.ts
 */
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { resolve } from "node:path";
import { db } from "../src/lib/db";

const DATA_DIR = resolve(__dirname, "..", "data");
const BATCH_SIZE = 2000;

type Row = Record<string, string>;

async function streamCsv(path: string): Promise<Row[]> {
  return new Promise((resolve, reject) => {
    const rows: Row[] = [];
    const rl = createInterface({
      input: createReadStream(path),
      crlfDelay: Infinity,
    });
    let headers: string[] | null = null;
    rl.on("line", (line) => {
      if (headers === null) {
        headers = parseCsvLine(line);
        return;
      }
      const values = parseCsvLine(line);
      const row: Row = {};
      headers.forEach((h, i) => {
        row[h] = values[i] ?? "";
      });
      rows.push(row);
    });
    rl.on("close", () => resolve(rows));
    rl.on("error", reject);
  });
}

/** Minimal CSV line parser that handles quoted fields with embedded commas. */
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else cur += c;
    }
  }
  out.push(cur);
  return out;
}

const toBool = (s: string) => s === "true" || s === "True";
const toDate = (s: string) => (s ? new Date(s + "T00:00:00.000Z") : null);
const toInt = (s: string) => (s === "" ? 0 : parseInt(s, 10));
const toFloat = (s: string) => (s === "" ? 0 : parseFloat(s));

async function chunkedCreateMany<T>(
  rows: T[],
  chunkSize: number,
  createFn: (chunk: T[]) => Promise<number>,
  label: string,
) {
  let total = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const n = await createFn(chunk);
    total += n;
    process.stdout.write(`\r  ${label}: ${total}/${rows.length} rows inserted`);
  }
  process.stdout.write("\n");
}

async function main() {
  console.log("Seeding MedLife Pharma database from CSVs...");
  console.log(`DATA_DIR = ${DATA_DIR}\n`);

  // Order matters: parents before children. We deleteMany in reverse first.
  console.log("→ clearing tables");
  await db.target.deleteMany();
  await db.expense.deleteMany();
  await db.sale.deleteMany();
  await db.visit.deleteMany();
  await db.product.deleteMany();
  await db.hcp.deleteMany();
  await db.rep.deleteMany();

  // 1. reps
  console.log("→ reps");
  const repsRaw = await streamCsv(`${DATA_DIR}/reps.csv`);
  await chunkedCreateMany(repsRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.rep.createMany({
      data: chunk.map((row) => ({
        repId: row.rep_id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        role: row.role,
        managerId: row.manager_id || null,
        zone: row.zone,
        state: row.state,
        city: row.city,
        hireDate: toDate(row.hire_date)!,
        exitDate: toDate(row.exit_date),
        status: row.status,
        baseSalaryInr: toInt(row.base_salary_inr),
        targetStretchPct: toFloat(row.target_stretch_pct),
      })),
    });
    return r.count;
  }, "reps");

  // 2. hcps
  console.log("→ hcps");
  const hcpsRaw = await streamCsv(`${DATA_DIR}/hcps.csv`);
  await chunkedCreateMany(hcpsRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.hcp.createMany({
      data: chunk.map((row) => ({
        hcpId: row.hcp_id,
        firstName: row.first_name,
        lastName: row.last_name,
        specialty: row.specialty,
        tier: row.tier,
        decile: toInt(row.decile),
        city: row.city,
        state: row.state,
        zone: row.zone,
        hospital: row.hospital || null,
        yearsPracticing: toInt(row.years_practicing),
        preferredContact: row.preferred_contact,
        npiLikeId: row.npi_like_id,
      })),
    });
    return r.count;
  }, "hcps");

  // 3. products
  console.log("→ products");
  const productsRaw = await streamCsv(`${DATA_DIR}/products.csv`);
  await db.product.createMany({
    data: productsRaw.map((row) => ({
      productId: row.product_id,
      productName: row.product_name,
      molecule: row.molecule,
      therapyArea: row.therapy_area,
      launchDate: toDate(row.launch_date)!,
      mrpInr: toInt(row.mrp_inr),
      packSize: toInt(row.pack_size),
      isNewLaunch: toBool(row.is_new_launch),
      priority: row.priority,
    })),
  });
  console.log(`  products: ${productsRaw.length} rows inserted`);

  // 4. visits
  console.log("→ visits");
  const visitsRaw = await streamCsv(`${DATA_DIR}/visits.csv`);
  await chunkedCreateMany(visitsRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.visit.createMany({
      data: chunk.map((row) => ({
        visitId: row.visit_id,
        repId: row.rep_id,
        hcpId: row.hcp_id,
        visitDate: toDate(row.visit_date)!,
        visitType: row.visit_type,
        durationMin: toInt(row.duration_min),
        productsDetailed: row.products_detailed,
        samplesDropped: toInt(row.samples_dropped),
        outcome: row.outcome,
        followupRequired: toBool(row.followup_required),
      })),
    });
    return r.count;
  }, "visits");

  // 5. sales
  console.log("→ sales");
  const salesRaw = await streamCsv(`${DATA_DIR}/sales.csv`);
  await chunkedCreateMany(salesRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.sale.createMany({
      data: chunk.map((row) => ({
        invoiceId: row.invoice_id,
        distributorId: row.distributor_id,
        repId: row.rep_id,
        hcpId: row.hcp_id,
        productId: row.product_id,
        qtyPacks: toInt(row.qty_packs),
        unitPriceInr: toInt(row.unit_price_inr),
        discountPct: toFloat(row.discount_pct),
        netValueInr: toInt(row.net_value_inr),
        invoiceDate: toDate(row.invoice_date)!,
        channel: row.channel,
      })),
    });
    return r.count;
  }, "sales");

  // 6. expenses
  console.log("→ expenses");
  const expensesRaw = await streamCsv(`${DATA_DIR}/expenses.csv`);
  await chunkedCreateMany(expensesRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.expense.createMany({
      data: chunk.map((row) => ({
        expenseId: row.expense_id,
        repId: row.rep_id,
        expenseDate: toDate(row.expense_date)!,
        category: row.category,
        amountInr: toInt(row.amount_inr),
        reimbursed: toBool(row.reimbursed),
        policyCompliant: toBool(row.policy_compliant),
        notes: row.notes || null,
      })),
    });
    return r.count;
  }, "expenses");

  // 7. targets
  console.log("→ targets");
  const targetsRaw = await streamCsv(`${DATA_DIR}/targets.csv`);
  await chunkedCreateMany(targetsRaw, BATCH_SIZE, async (chunk) => {
    const r = await db.target.createMany({
      data: chunk.map((row) => ({
        targetId: row.target_id,
        repId: row.rep_id,
        productId: row.product_id,
        fy: toInt(row.fy),
        quarter: row.quarter,
        targetQty: toInt(row.target_qty),
        targetValueInr: toInt(row.target_value_inr),
      })),
    });
    return r.count;
  }, "targets");

  // Counts
  console.log("\n=== Final DB counts ===");
  const counts = {
    reps: await db.rep.count(),
    hcps: await db.hcp.count(),
    products: await db.product.count(),
    visits: await db.visit.count(),
    sales: await db.sale.count(),
    expenses: await db.expense.count(),
    targets: await db.target.count(),
  };
  for (const [k, v] of Object.entries(counts)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log(`\n  TOTAL: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);

  await db.$disconnect();
  console.log("\nSeed complete.");
}

main().catch(async (err) => {
  console.error("Seed failed:", err);
  await db.$disconnect();
  process.exit(1);
});
