#!/usr/bin/env node
/**
 * Master CSV uploader for Readathon V2
 * Reads a single sheet with recordType rows:
 *   - user
 *   - homeroom
 * (and supports future: transaction/link/inventory if you add those recordTypes later)
 *
 * SAFE DEFAULT: dry-run (no writes) unless you pass --commit
 *admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "lrcquest-3039e", // 👈 ADD THIS
});
 * Usage:
 *   node tools/ratUploader.cjs --csv data_imports/ratUploader_308_longbeach_elementary.csv
 *   node tools/ratUploader.cjs --csv data_imports/ratUploader_308_longbeach_elementary.csv --commit
 *
 * Optional:
 *   --schoolId 308_longbeach_elementary   (overrides per-row schoolId if provided)
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

function parseArgs() {
  const args = process.argv.slice(2);
  const out = { commit: false, csv: "", schoolId: "" };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--commit") out.commit = true;
    else if (a === "--csv") out.csv = args[++i] || "";
    else if (a === "--schoolId") out.schoolId = args[++i] || "";
  }
  return out;
}

function readCSV(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = splitCsvLine(lines[i]);
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (parts[idx] ?? "").trim());
    rows.push(obj);
  }
  return rows;
}

// simple CSV splitter that respects quotes
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function asBool(v) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "true" || s === "1" || s === "yes" || s === "y") return true;
  if (s === "false" || s === "0" || s === "no" || s === "n") return false;
  return false;
}

function asNum(v, fallback = 0) {
  if (v === "" || v == null) return fallback;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function asStr(v) {
  if (v == null) return "";
  // handle common "5122025.0" style values from spreadsheets
  let s = String(v).trim();
  if (s.endsWith(".0")) s = s.slice(0, -2);
  return s;
}

function parseCanAwardHomerooms(v) {
  const s = asStr(v);
  if (!s) return undefined;
  if (s.toUpperCase() === "ALL") return "ALL";
  // allow pipe-separated OR comma-separated
  const parts = s.includes("|") ? s.split("|") : s.split(",");
  return parts.map(x => x.trim()).filter(Boolean);
}

function rootSchool(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

function userPath(schoolId, userId) {
  return `${rootSchool(schoolId)}/users/${userId}`;
}
function secretPath(schoolId, userId) {
  return `${rootSchool(schoolId)}/secrets/${userId}`;
}
function publicStudentPath(schoolId, studentId) {
  return `${rootSchool(schoolId)}/publicStudents/${studentId}`;
}
function homeroomPath(schoolId, homeroomId) {
  return `${rootSchool(schoolId)}/homerooms/${homeroomId}`;
}
function summaryPath(schoolId, userId) {
  return `${rootSchool(schoolId)}/users/${userId}/readathon/summary`;
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function main() {
  const { csv, commit, schoolId: schoolOverride } = parseArgs();
  if (!csv) {
    console.log("Missing --csv path");
    process.exit(1);
  }
  const csvPath = path.resolve(process.cwd(), csv);
  if (!fs.existsSync(csvPath)) {
    console.log(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  // Uses Application Default Credentials:
  // - easiest: set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON
  // - or use firebase CLI auth + ADC (depends on setup)
  admin.initializeApp({

      credential: admin.credential.cert(serviceAccount),
  projectId: "lrcquest-3039e", // 👈 ADD THIS
  });
  const db = admin.firestore();

  const rows = readCSV(csvPath);

  // Normalize + filter empty rows
  const clean = rows
    .map(r => ({
      recordType: asStr(r.recordType).toLowerCase(),
      schoolId: (schoolOverride || asStr(r.schoolId) || "308_longbeach_elementary").trim(),
      userId: asStr(r.userId).toLowerCase().trim(),
      role: asStr(r.role).toLowerCase().trim(),
      displayName: asStr(r.displayName).trim(),
      email: asStr(r.email).trim(),
      grade: asNum(r.grade, NaN),
      homeroomId: asStr(r.homeroomId).toLowerCase().trim(),
      active: asBool(r.active),
      pinPlain: asStr(r.pinPlain),

      teacherId: asStr(r.teacherId).toLowerCase().trim(),

      minutesTotal: asNum(r.minutesTotal, 0),
      rubiesBalance: asNum(r.rubiesBalance, 0),
      rubiesLifetimeEarned: asNum(r.rubiesLifetimeEarned, 0),
      rubiesLifetimeSpent: asNum(r.rubiesLifetimeSpent, 0),
      moneyRaisedCents: asNum(r.moneyRaisedCents, 0),

      canAwardHomerooms: parseCanAwardHomerooms(r.canAwardHomerooms),
    }))
    .filter(r => r.recordType && r.schoolId);

  const users = clean.filter(r => r.recordType === "user");
  const homerooms = clean.filter(r => r.recordType === "homeroom");

  console.log("----- RAT UPLOADER -----");
  console.log("CSV:", csvPath);
  console.log("Mode:", commit ? "COMMIT (writes enabled)" : "DRY RUN (no writes)");
  console.log("Rows:", clean.length);
  console.log("Users:", users.length);
  console.log("Homerooms:", homerooms.length);
  console.log("------------------------\n");

  // Validate PINs (must be 4 digits). If not, we skip hashing and warn.
  const badPins = users
    .filter(u => u.pinPlain && !/^\d{4}$/.test(u.pinPlain))
    .slice(0, 20);

  if (badPins.length) {
    console.log("⚠️ Found PINs that are NOT 4 digits (showing up to 20):");
    for (const b of badPins) console.log(`  ${b.userId}: pinPlain="${b.pinPlain}"`);
    console.log("These will be SKIPPED for secrets unless you fix them to 4 digits.\n");
  }

  if (!commit) {
    console.log("Dry run complete. Add --commit to write to Firestore.\n");
    return;
  }

  // ---- Write homerooms first ----
  // In your sheet, homeroom rows often store hr_id in userId column.
  const homeroomWrites = [];
  for (const hr of homerooms) {
    const homeroomId = hr.userId || hr.homeroomId; // prefer userId if that’s where hr_ is
    if (!homeroomId) continue;

    homeroomWrites.push({
      schoolId: hr.schoolId,
      homeroomId,
      data: {
        teacherId: hr.teacherId || null,
        grade: Number.isFinite(hr.grade) ? hr.grade : null,
        active: hr.active === true,
      },
    });
  }

  for (const group of chunk(homeroomWrites, 450)) {
    const batch = db.batch();
    for (const w of group) {
      const ref = db.doc(homeroomPath(w.schoolId, w.homeroomId));
      batch.set(ref, w.data, { merge: true });
    }
    await batch.commit();
    console.log(`✅ Homerooms batch committed: ${group.length}`);
  }

  // ---- Write users, secrets, summaries, publicStudents ----
  const userWrites = [];
  const secretWrites = [];
  const summaryWrites = [];
  const publicStudentWrites = [];

  for (const u of users) {
    if (!u.userId) continue;

    // Users doc
    const userDoc = {
      active: u.active === true,
      role: u.role || null,
      displayName: u.displayName || null,
      email: u.email || null,
    };

    if (u.canAwardHomerooms !== undefined) {
      userDoc.canAwardHomerooms = u.canAwardHomerooms;
    }

    userWrites.push({ schoolId: u.schoolId, userId: u.userId, data: userDoc });

    // Secrets doc (PIN hash)
    if (u.pinPlain && /^\d{4}$/.test(u.pinPlain)) {
      const pinHash = bcrypt.hashSync(u.pinPlain, 10);
      secretWrites.push({ schoolId: u.schoolId, userId: u.userId, data: { pinHash } });
    }

    // Summary seed
    const summaryDoc = {
      minutesTotal: u.minutesTotal || 0,
      minutesPendingTotal: 0,
      moneyRaisedCents: u.moneyRaisedCents || 0,
      rubiesBalance: u.rubiesBalance || 0,
      rubiesLifetimeEarned: u.rubiesLifetimeEarned || 0,
      rubiesLifetimeSpent: u.rubiesLifetimeSpent || 0,
    };
    summaryWrites.push({ schoolId: u.schoolId, userId: u.userId, data: summaryDoc });

    // publicStudents only for student_#### users (for student login picker)
    if (u.userId.startsWith("student_")) {
      const pubDoc = {
        displayName: u.displayName || u.userId,
        grade: Number.isFinite(u.grade) ? u.grade : null,
        homeroomId: u.homeroomId || null,
        active: u.active === true,
      };
      publicStudentWrites.push({ schoolId: u.schoolId, studentId: u.userId, data: pubDoc });
    }
  }

  // Batch commit helper
  async function commitBatches(writes, getRef) {
    for (const group of chunk(writes, 450)) {
      const batch = db.batch();
      for (const w of group) {
        batch.set(getRef(w), w.data, { merge: true });
      }
      await batch.commit();
      console.log(`✅ Batch committed: ${group.length}`);
    }
  }

  console.log("\nWriting users...");
  await commitBatches(userWrites, (w) => db.doc(userPath(w.schoolId, w.userId)));

  console.log("\nWriting secrets (PIN hashes)...");
  await commitBatches(secretWrites, (w) => db.doc(secretPath(w.schoolId, w.userId)));

  console.log("\nWriting summaries...");
  await commitBatches(summaryWrites, (w) => db.doc(summaryPath(w.schoolId, w.userId)));

  console.log("\nWriting publicStudents...");
  await commitBatches(publicStudentWrites, (w) => db.doc(publicStudentPath(w.schoolId, w.studentId)));

  console.log("\n🎉 Upload complete!");
  console.log(`Users written: ${userWrites.length}`);
  console.log(`Secrets written (valid PINs): ${secretWrites.length}`);
  console.log(`Summaries written: ${summaryWrites.length}`);
  console.log(`publicStudents written: ${publicStudentWrites.length}`);
}

main().catch((e) => {
  console.error("Uploader failed:", e);
  process.exit(1);
});