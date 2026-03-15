#!/usr/bin/env node
/**
 * Bulk uploader for Avatar Catalog Items (Readathon V2)
 *
 * Writes documents to:
 * readathonV2_schools/{schoolId}/avatarCatalog/catalog/items/{itemId}
 *
 * SAFE DEFAULT: dry-run (no writes) unless you pass --commit
 *
 * Usage:
 * node tools/avatarCatalogUploader.cjs --csv data_imports/file.csv
 * node tools/avatarCatalogUploader.cjs --csv data_imports/file.csv --commit
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

function toJson(v) {
  if (v === "" || v == null) return undefined;
  try {
    return JSON.parse(v);
  } catch {
    throw new Error(`Invalid JSON: ${v}`);
  }
}

function toTimestamp(v) {
  if (v === "" || v == null) return undefined;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${v}`);
  return admin.firestore.Timestamp.fromDate(d);
}

/* ---------------- VALIDATION ---------------- */

function normalizeRow(rowObj) {
  const allowedTypes = new Set([
    "base",
    "head",
    "clothes",
    "accessory",
    "pet",
    "wall",
    "floor",
    "background",
  ]);

  const allowedRarity = new Set(["common", "uncommon", "rare", "epic", "legendary"]);

  const allowedSlots = new Set([
    "base",
    "head",
    "clothes",
    "accessory",
    "pet",
    "wall",
    "floor",
    "background",
  ]);

  const schoolId = rowObj.schoolId?.trim();
  const itemId = rowObj.itemId?.trim();
  const name = rowObj.name?.trim();
  const type = rowObj.type?.trim();
  const rarity = rowObj.rarity?.trim() || "common";

  if (!schoolId) throw new Error("schoolId required");
  if (!itemId) throw new Error("itemId required");
  if (!name) throw new Error("name required");
  if (!allowedTypes.has(type)) throw new Error(`Invalid type: ${type}`);
  if (!allowedRarity.has(rarity)) throw new Error(`Invalid rarity: ${rarity}`);

  const price = toNum(rowObj.price);
  if (price == null) throw new Error("price required");

  const enabled = toBool(rowObj.enabled);
  if (enabled == null) throw new Error("enabled required");

  const sort = toNum(rowObj.sort);
  if (sort == null) throw new Error("sort required");

  const imagePath = rowObj.imagePath?.trim();
  if (!imagePath?.startsWith("/")) throw new Error("imagePath must start with /");
  if (!imagePath.endsWith(".png")) throw new Error("imagePath must end with .png");

const subslot = rowObj.subslot?.trim();
const description = rowObj.description?.trim();
const collection = rowObj.collection?.trim().toLowerCase();
const collectionItem = rowObj.collectionItem?.trim().toLowerCase();
const isNew = toBool(rowObj.isNew);
const seasonEnd = rowObj.seasonEnd?.trim();
const sortOrder = toNum(rowObj.sortOrder);

  if (slot && !allowedSlots.has(slot)) throw new Error(`Invalid slot: ${slot}`);

  const previewScale = toNum(rowObj.previewScale);
  const previewOffset = toJson(rowObj.previewOffsetJson);
  const requires = toJson(rowObj.requiresJson);
  const maxQty = toNum(rowObj.maxQty) ?? 99;

  return {
    schoolId,
    itemId,
doc: {
  name,
  itemId,
  type,
  price,
  imagePath,
  enabled,
  rarity,
  sort,
  sortOrder: sortOrder ?? sort,
  maxQty,

  ...(slot && { slot }),
  ...(subslot && { subslot }),
  ...(description && { description }),

  ...(previewScale != null && { previewScale }),
  ...(previewOffset != null && { previewOffsetJson: JSON.stringify(previewOffset) }),
  ...(requires && { requires }),

  ...(collection && { collection }),
  ...(collectionItem && { collectionItem }),
  ...(isNew != null && { isNew }),

  ...(rowObj.season && String(rowObj.season).trim()
    ? { season: String(rowObj.season).trim().toLowerCase() }
    : {}),

  ...(seasonEnd ? { seasonEnd } : {}),
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

  console.log("----- AVATAR CATALOG UPLOADER -----");
  console.log("CSV:", abs);
  console.log("Mode:", commit ? "COMMIT (writes enabled)" : "DRY RUN (no writes)");
  console.log("Write style:", overwrite ? "OVERWRITE (merge:false)" : "MERGE (merge:true)");
  console.log("Rows:", parsed.length);
  console.log("-----------------------------------\n");

  const writeOpts = { merge: !overwrite };
  const BATCH_SIZE = 450;

  for (let i = 0; i < parsed.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const chunk = parsed.slice(i, i + BATCH_SIZE);

    for (const item of chunk) {
      const ref = db
        .collection("readathonV2_schools")
        .doc(item.schoolId)
        .collection("avatarCatalog")
        .doc("catalog")
        .collection("items")
        .doc(item.itemId);

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