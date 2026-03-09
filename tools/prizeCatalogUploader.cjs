#!/usr/bin/env node
/**
 * Bulk uploader for Prize Catalog Items (Readathon V2)
 *
 * Writes documents to:
 * readathonV2_schools/{schoolId}/prizeCatalog/{prizeId}
 *
 * SAFE DEFAULT: dry-run (no writes) unless you pass --commit
 *
 * Usage:
 * node tools/prizeCatalogUploader.cjs --csv data_imports/prizeCatalog.csv
 * node tools/prizeCatalogUploader.cjs --csv data_imports/prizeCatalog.csv --commit
 *
 * Optional:
 * --schoolId 308_longbeach_elementary   (override per-row schoolId)
 * --overwrite                           (writes with merge:false; replaces docs)
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// 🔐 YOUR SERVICE ACCOUNT
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

// Initialize Firebase Admin ONCE
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: "lrcquest-3039e",
  });
}

/* ---------------- ARG PARSER ---------------- */

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { commit: false, overwrite: false, csv: "", schoolId: "" };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--commit") out.commit = true;
    else if (a === "--overwrite") out.overwrite = true;
    else if (a === "--csv") out.csv = args[++i] || "";
    else if (a === "--schoolId") out.schoolId = args[++i] || "";
  }

  if (!out.csv) {
    console.error("❌ Missing --csv path");
    process.exit(1);
  }

  return out;
}

/* ---------------- CSV PARSER ---------------- */

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
      continue;
    }

    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur);
      rows.push(row);
      row = [];
      cur = "";
    } else if (ch !== "\r") {
      cur += ch;
    }
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  return rows;
}

/* ---------------- HELPERS ---------------- */

function toBool(v) {
  if (v === "" || v == null) return undefined;
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "y"].includes(s)) return true;
  if (["false", "0", "no", "n"].includes(s)) return false;
  throw new Error(`Invalid boolean: ${v}`);
}

function toNum(v) {
  if (v === "" || v == null) return undefined;
  const n = Number(String(v).replace(/,/g, ""));
  if (Number.isNaN(n)) throw new Error(`Invalid number: ${v}`);
  return n;
}

function toTimestamp(v) {
  if (v === "" || v == null) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${v}`);
  return admin.firestore.Timestamp.fromDate(d);
}

/* ---------------- VALIDATION ---------------- */

function normalizeRow(rowObj) {
  const allowedCategories = new Set([
    "small",
    "school",
    "plush",
    "toys",
    "electronics",
    "books",
    "other",
  ]);

  const schoolId = String(rowObj.schoolId || "").trim();
  const prizeId = String(rowObj.prizeId || "").trim();
  const name = String(rowObj.name || "").trim();
  const category = String(rowObj.category || "other").trim().toLowerCase();
  const description = String(rowObj.description || "").trim();
  const image = String(rowObj.image || "").trim();

  if (!schoolId) throw new Error("schoolId required");
  if (!prizeId) throw new Error("prizeId required");
  if (!name) throw new Error("name required");
  if (!allowedCategories.has(category)) {
    throw new Error(`Invalid category: ${category}`);
  }

  const price = toNum(rowObj.price);
  if (price == null) throw new Error("price required");
  if (price < 0) throw new Error("price must be >= 0");

  const stock = toNum(rowObj.stock);
  if (stock == null) throw new Error("stock required");
  if (stock < 0) throw new Error("stock must be >= 0");

  const active = toBool(rowObj.active);
  if (active == null) throw new Error("active required");

  const sort = toNum(rowObj.sort) ?? 9999;

  const minimumDonationsNeeded = Number((price / 0.20).toFixed(2));

  return {
    schoolId,
    prizeId,
    doc: {
      prizeId,
      name,
      category,
      description,
      image,
      price: Number(price.toFixed(2)),
      stock,
      active,
      sort,
      minimumDonationsNeeded,
    },
    createdAt: toTimestamp(rowObj.createdAt),
    updatedAt: toTimestamp(rowObj.updatedAt),
  };
}

/* ---------------- MAIN ---------------- */

async function main() {
  const { commit, overwrite, csv, schoolId: override } = parseArgs();

  const db = admin.firestore();
  const FieldValue = admin.firestore.FieldValue;

  const abs = path.resolve(process.cwd(), csv);
  if (!fs.existsSync(abs)) {
    console.error(`❌ CSV not found: ${abs}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(abs, "utf8");
  const rows = parseCsv(raw);
  if (!rows.length) {
    console.error("❌ CSV appears empty");
    process.exit(1);
  }

  const header = rows[0].map((h) => String(h || "").trim());

  const data = rows
    .slice(1)
    .filter((r) => r.some((cell) => String(cell ?? "").trim() !== ""));

  const parsed = [];

  for (let i = 0; i < data.length; i++) {
    const obj = {};
    header.forEach((h, idx) => (obj[h] = data[i][idx]));
    if (override) obj.schoolId = override;
    parsed.push(normalizeRow(obj));
  }

  console.log("----- PRIZE CATALOG UPLOADER -----");
  console.log("CSV:", abs);
  console.log("Mode:", commit ? "COMMIT (writes enabled)" : "DRY RUN (no writes)");
  console.log("Write style:", overwrite ? "OVERWRITE (merge:false)" : "MERGE (merge:true)");
  console.log("Rows:", parsed.length);
  console.log("----------------------------------\n");

  const writeOpts = { merge: !overwrite };
  const BATCH_SIZE = 450;

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = parsed.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const ref = db
        .collection("readathonV2_schools")
        .doc(item.schoolId)
        .collection("prizeCatalog")
        .doc(item.prizeId);

      const payload = {
        ...item.doc,
        createdAt: item.createdAt ?? FieldValue.serverTimestamp(),
        updatedAt: item.updatedAt ?? FieldValue.serverTimestamp(),
      };

      if (commit) batch.set(ref, payload, writeOpts);
      else console.log("[DRY]", ref.path, payload);
    }

    if (commit) {
      await batch.commit();
      console.log(`✅ Batch committed: ${chunk.length}`);
    }
  }

  console.log("\n🎉 Done");
}

main().catch((err) => {
  console.error("Uploader failed:", err);
  process.exit(1);
});