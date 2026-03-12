#!/usr/bin/env node

/**
 * monarchUploader.cjs
 *
 * Usage:
 *   node lrcquest.org/tools/monarchUploader.cjs path/to/monarch.csv
 *
 * Optional:
 *   node lrcquest.org/tools/monarchUploader.cjs path/to/monarch.csv 308_longbeach_elementary
 *
 * Expected env:
 *   GOOGLE_APPLICATION_CREDENTIALS=path/to/serviceAccountKey.json
 *
 * CSV format headers:
 * recordType,id,title,subtitle,active,taskOrder,roundKey,type,required,matchupId,nomineeIds,rewardPreviewKey,milestoneCount,author,description,coverImageUrl,videoEmbedUrl,schoolYear,requiredTaskCount
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

/* =========================================================
   BOOT
========================================================= */

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
  });
}

const db = admin.firestore();

/* =========================================================
   CONFIG
========================================================= */

const DEFAULT_SCHOOL_ID = "308_longbeach_elementary";
const DEFAULT_EVENT_ID = "monarch_2026";

/* =========================================================
   CLI ARGS
========================================================= */

const csvPathArg = process.argv[2];
const schoolIdArg = process.argv[3] || DEFAULT_SCHOOL_ID;

if (!csvPathArg) {
  console.error("❌ Missing CSV file path.");
  console.error("Usage: node lrcquest.org/tools/monarchUploader.cjs path/to/monarch.csv [schoolId]");
  process.exit(1);
}

const csvPath = path.resolve(csvPathArg);
const schoolId = String(schoolIdArg).trim();

if (!fs.existsSync(csvPath)) {
  console.error(`❌ CSV file not found: ${csvPath}`);
  process.exit(1);
}

/* =========================================================
   CSV PARSER
========================================================= */

function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawLines = normalized.split("\n").filter((line) => line.trim() !== "");

  if (!rawLines.length) {
    throw new Error("CSV is empty.");
  }

  const headers = parseCsvLine(rawLines[0]).map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < rawLines.length; i += 1) {
    const values = parseCsvLine(rawLines[i]);
    const row = {};

    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = (values[j] ?? "").trim();
    }

    rows.push(row);
  }

  return rows;
}

/* =========================================================
   HELPERS
========================================================= */

function asString(value, fallback = "") {
  return String(value ?? "").trim() || fallback;
}

function asBool(value, fallback = false) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["true", "1", "yes", "y"].includes(raw)) return true;
  if (["false", "0", "no", "n"].includes(raw)) return false;
  return fallback;
}

function asInt(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

function asNullableString(value) {
  const raw = String(value ?? "").trim();
  return raw ? raw : null;
}

function asPipeArray(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

function requiredField(row, fieldName) {
  const value = asString(row[fieldName]);
  if (!value) {
    throw new Error(`Missing required field "${fieldName}" for row id="${row.id || "(no id)"}" recordType="${row.recordType || "(no type)"}"`);
  }
  return value;
}

function schoolDoc(schoolId) {
  return db.collection("readathonV2_schools").doc(schoolId);
}

function eventDoc(schoolId, eventId) {
  return schoolDoc(schoolId).collection("monarchQuest").doc(eventId);
}

function nomineesCol(schoolId, eventId) {
  return eventDoc(schoolId, eventId).collection("nominees");
}

function tasksCol(schoolId, eventId) {
  return eventDoc(schoolId, eventId).collection("tasks");
}

function rewardsCol(schoolId, eventId) {
  return eventDoc(schoolId, eventId).collection("rewards");
}

/* =========================================================
   VALIDATION
========================================================= */

function validateHeaders(rows) {
  if (!rows.length) {
    throw new Error("CSV has no data rows.");
  }

  const first = rows[0];
  const requiredHeaders = [
    "recordType",
    "id",
    "title",
    "active",
  ];

  for (const header of requiredHeaders) {
    if (!(header in first)) {
      throw new Error(`Missing required CSV header: ${header}`);
    }
  }
}

function splitRowsByType(rows) {
  const configRows = [];
  const nomineeRows = [];
  const taskRows = [];
  const rewardRows = [];

  for (const row of rows) {
    const recordType = asString(row.recordType).toLowerCase();

    if (recordType === "config") configRows.push(row);
    else if (recordType === "nominee") nomineeRows.push(row);
    else if (recordType === "task") taskRows.push(row);
    else if (recordType === "reward") rewardRows.push(row);
    else {
      throw new Error(`Unknown recordType "${row.recordType}" for row id="${row.id || "(no id)"}"`);
    }
  }

  return { configRows, nomineeRows, taskRows, rewardRows };
}

function ensureSingleConfigRow(configRows) {
  if (configRows.length === 0) {
    throw new Error("CSV must include exactly one config row.");
  }
  if (configRows.length > 1) {
    throw new Error("CSV can only include one config row.");
  }
}

/* =========================================================
   BUILDERS
========================================================= */

function buildConfigDoc(configRow, eventId) {
  return {
    eventId,
    active: asBool(configRow.active, true),
    title: requiredField(configRow, "title"),
    subtitle: asString(configRow.subtitle),
    schoolYear: asString(configRow.schoolYear),
    requiredTaskCount: asInt(configRow.requiredTaskCount, 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildNomineeDoc(row) {
  const nomineeId = requiredField(row, "id");

  return {
    nomineeId,
    active: asBool(row.active, true),
    title: requiredField(row, "title"),
    subtitle: asString(row.subtitle),
    author: asString(row.author),
    description: asString(row.description),
    coverImageUrl: asString(row.coverImageUrl),
    videoEmbedUrl: asString(row.videoEmbedUrl),
    taskOrder: asInt(row.taskOrder, 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildTaskDoc(row) {
  const taskId = requiredField(row, "id");
  const nomineeIds = asPipeArray(row.nomineeIds);

  if (nomineeIds.length !== 2) {
    throw new Error(`Task "${taskId}" must have exactly 2 nomineeIds separated by "|".`);
  }

  return {
    taskId,
    active: asBool(row.active, true),
    title: requiredField(row, "title"),
    subtitle: asString(row.subtitle),
    taskOrder: asInt(row.taskOrder, 0),
    roundKey: asString(row.roundKey),
    type: asString(row.type, "MATCHUP").toUpperCase(),
    required: asBool(row.required, true),
    matchupId: requiredField(row, "matchupId"),
    nomineeIds,
    rewardPreviewKey: asString(row.rewardPreviewKey),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

function buildRewardDoc(row) {
  const rewardKey = requiredField(row, "id");

  return {
    rewardKey,
    active: asBool(row.active, true),
    title: requiredField(row, "title"),
    subtitle: asString(row.subtitle),
    milestoneCount: asInt(row.milestoneCount, 0),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
}

/* =========================================================
   UPLOAD
========================================================= */

async function uploadConfig(schoolId, eventId, configRow) {
  const ref = eventDoc(schoolId, eventId);
  const payload = buildConfigDoc(configRow, eventId);

  console.log(`🟡 Writing config doc: monarchQuest/${eventId}`);
  await ref.set(payload, { merge: true });
}

async function uploadNominees(schoolId, eventId, nomineeRows) {
  for (const row of nomineeRows) {
    const nomineeId = requiredField(row, "id");
    const payload = buildNomineeDoc(row);

    console.log(`🟡 Writing nominee: ${nomineeId}`);
    await nomineesCol(schoolId, eventId).doc(nomineeId).set(payload, { merge: true });
  }
}

async function uploadTasks(schoolId, eventId, taskRows) {
  for (const row of taskRows) {
    const taskId = requiredField(row, "id");
    const payload = buildTaskDoc(row);

    console.log(`🟡 Writing task: ${taskId}`);
    await tasksCol(schoolId, eventId).doc(taskId).set(payload, { merge: true });
  }
}

async function uploadRewards(schoolId, eventId, rewardRows) {
  for (const row of rewardRows) {
    const rewardKey = requiredField(row, "id");
    const payload = buildRewardDoc(row);

    console.log(`🟡 Writing reward: ${rewardKey}`);
    await rewardsCol(schoolId, eventId).doc(rewardKey).set(payload, { merge: true });
  }
}

/* =========================================================
   MAIN
========================================================= */

async function main() {
  try {
    console.log("========================================");
    console.log("Monarch Uploader Starting");
    console.log("========================================");
    console.log(`CSV: ${csvPath}`);
    console.log(`School ID: ${schoolId}`);

    const csvText = fs.readFileSync(csvPath, "utf8");
    const rows = parseCsv(csvText);

    validateHeaders(rows);

    const { configRows, nomineeRows, taskRows, rewardRows } = splitRowsByType(rows);
    ensureSingleConfigRow(configRows);

    const configRow = configRows[0];
    const eventId = asString(configRow.id, DEFAULT_EVENT_ID);

    console.log(`Event ID: ${eventId}`);
    console.log(`Config rows: ${configRows.length}`);
    console.log(`Nominee rows: ${nomineeRows.length}`);
    console.log(`Task rows: ${taskRows.length}`);
    console.log(`Reward rows: ${rewardRows.length}`);

    await uploadConfig(schoolId, eventId, configRow);
    await uploadNominees(schoolId, eventId, nomineeRows);
    await uploadTasks(schoolId, eventId, taskRows);
    await uploadRewards(schoolId, eventId, rewardRows);

    console.log("========================================");
    console.log("✅ Monarch upload complete");
    console.log("========================================");
  } catch (err) {
    console.error("========================================");
    console.error("❌ Monarch upload failed");
    console.error("========================================");
    console.error(err);
    process.exit(1);
  }
}

main();