#!/usr/bin/env node

/**
 * prizeCatalogUploader.cjs
 *
 * Reads:
 *   /data_imports/prizeCatalogUploader.csv
 *
 * Uploads to:
 *   /readathonV2_schools/{schoolId}/prizeCatalog/{prizeId}
 *
 * Required CSV headings:
 * schoolId
 * prizeId
 * image
 * name
 * price
 * donationsNeeded
 * shelf
 * sort
 * category
 * description
 * active
 *
 * Usage:
 *   node tools/prizeCatalogUploader.cjs
 *
 * Requires:
 *   GOOGLE_APPLICATION_CREDENTIALS to point to a Firebase service account json file
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(PROJECT_ROOT, "data_imports", "prizeCatalogUploader.csv");

const REQUIRED_HEADERS = [
  "schoolId",
  "prizeId",
  "image",
  "name",
  "price",
  "donationsNeeded",
  "shelf",
  "sort",
  "category",
  "description",
  "active",
];

initFirebase();
main().catch((err) => {
  console.error("\nUpload failed.");
  console.error(err);
  process.exit(1);
});

function initFirebase() {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }
}

async function main() {
  console.log(`\nReading CSV: ${CSV_PATH}`);

  if (!fs.existsSync(CSV_PATH)) {
    throw new Error(`CSV file not found at ${CSV_PATH}`);
  }

  const rawCsv = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(rawCsv);

  if (!rows.length) {
    throw new Error("CSV has no data rows.");
  }

  validateHeaders(rows[0]);

  const db = admin.firestore();
  const batchSize = 400;

  let totalProcessed = 0;
  let totalSkipped = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const row of rows) {
    try {
      const cleaned = normalizeRow(row);

      if (!cleaned.schoolId || !cleaned.prizeId) {
        totalSkipped++;
        console.warn("Skipping row because schoolId or prizeId is missing:", row);
        continue;
      }

      const ref = db
        .collection("readathonV2_schools")
        .doc(cleaned.schoolId)
        .collection("prizeCatalog")
        .doc(cleaned.prizeId);

      batch.set(ref, cleaned.docData, { merge: true });
      opsInBatch++;
      totalProcessed++;

      if (opsInBatch >= batchSize) {
        await batch.commit();
        console.log(`Committed batch of ${opsInBatch} writes...`);
        batch = db.batch();
        opsInBatch = 0;
      }
    } catch (err) {
      totalSkipped++;
      console.warn("Skipping invalid row:", row);
      console.warn("Reason:", err.message);
    }
  }

  if (opsInBatch > 0) {
    await batch.commit();
    console.log(`Committed final batch of ${opsInBatch} writes...`);
  }

  console.log("\nUpload complete.");
  console.log(`Processed: ${totalProcessed}`);
  console.log(`Skipped:   ${totalSkipped}`);
}

function validateHeaders(sampleRow) {
  const foundHeaders = Object.keys(sampleRow);
  const missing = REQUIRED_HEADERS.filter((h) => !foundHeaders.includes(h));

  if (missing.length) {
    throw new Error(`CSV is missing required headers: ${missing.join(", ")}`);
  }
}

function normalizeRow(row) {
  const schoolId = String(row.schoolId || "").trim();
  const prizeId = String(row.prizeId || "").trim();

  const docData = {
    schoolId,
    prizeId,
    image: String(row.image || "").trim(),
    name: String(row.name || "").trim(),
    price: toNumber(row.price),
    donationsNeeded: toNumber(row.donationsNeeded),
    shelf: String(row.shelf || "").trim(),
    sort: toNumber(row.sort, 9999),
    category: String(row.category || "").trim(),
    description: String(row.description || "").trim(),
    active: toBoolean(row.active),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (!docData.name) {
    throw new Error("Missing name");
  }

  return {
    schoolId,
    prizeId,
    docData,
  };
}

function toNumber(value, fallback = 0) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["true", "1", "yes", "y"].includes(normalized);
}

/**
 * Minimal CSV parser with quoted field support.
 */
function parseCsv(csvText) {
  const rows = [];
  let i = 0;
  let field = "";
  let row = [];
  let insideQuotes = false;

  while (i < csvText.length) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (insideQuotes && next === '"') {
        field += '"';
        i += 2;
        continue;
      }
      insideQuotes = !insideQuotes;
      i++;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
      i++;
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") {
        i++;
      }

      row.push(field);
      field = "";

      if (row.some((cell) => String(cell).trim() !== "")) {
        rows.push(row);
      }

      row = [];
      i++;
      continue;
    }

    field += char;
    i++;
  }

  if (field.length || row.length) {
    row.push(field);
    if (row.some((cell) => String(cell).trim() !== "")) {
      rows.push(row);
    }
  }

  if (!rows.length) return [];

  const headers = rows[0].map((h) => String(h).trim());
  const dataRows = rows.slice(1);

  return dataRows.map((cells) => {
    const obj = {};
    for (let idx = 0; idx < headers.length; idx++) {
      obj[headers[idx]] = cells[idx] ?? "";
    }
    return obj;
  });
}