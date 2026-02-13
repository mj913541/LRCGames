// uploadReadathonDeltas.cjs
// Run: node uploadReadathonDeltas.cjs readathon_deltas.csv
// Purpose: Safely INCREMENT earned totals (minutes/sparks/money) without touching spent totals.

const fs = require("fs");
const admin = require("firebase-admin");

// ---------- CONFIG ----------
const SCHOOL_DOC_ID = "main";
const STUDENT_COLLECTION_NAME = "students";
// ---------------------------

if (!admin.apps.length) {
  const svc = JSON.parse(fs.readFileSync("./serviceAccountKey.json", "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(svc) });
}
const db = admin.firestore();

function normalizeId(input) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replaceAll("&", "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsv(csvText) {
  const lines = csvText.split(/\r?\n/).filter(Boolean);
  const headers = lines[0].split(",").map(h => h.trim());
  return lines.slice(1).map(line => {
    const cells = line.split(",").map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

function numOrZero(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.log("❌ Provide CSV path: node uploadReadathonDeltas.cjs readathon_deltas.csv");
    process.exit(1);
  }

  const csvText = fs.readFileSync(csvPath, "utf8");
  const rows = parseCsv(csvText);

  console.log(`📄 Rows found: ${rows.length}`);

  const batch = db.batch();
  let writes = 0;

  for (const r of rows) {
    const studentId = String(r.studentId || "").trim();
    const gradeRaw = String(r.grade || "").trim();
    const homeroomRaw = String(r.homeroom || "").trim();

    // ✅ These are DELTAS (adds)
    const minutesAdd = numOrZero(r.minutesAdd);
    const sparksAdd = numOrZero(r.sparksAdd);
    const moneyAdd = numOrZero(r.moneyAdd);

    if (!studentId || !gradeRaw || !homeroomRaw) {
      console.log("⚠️ Skipping row (missing studentId/grade/homeroom):", r);
      continue;
    }

    // If a row has no changes, skip it
    if (minutesAdd === 0 && sparksAdd === 0 && moneyAdd === 0) {
      continue;
    }

    // Safety bounds (adjust if you want)
    if (minutesAdd < 0 || minutesAdd > 2000) {
      console.log(`⚠️ Skipping ${studentId}: minutesAdd out of range (${minutesAdd})`);
      continue;
    }
    if (sparksAdd < 0 || sparksAdd > 20000) {
      console.log(`⚠️ Skipping ${studentId}: sparksAdd out of range (${sparksAdd})`);
      continue;
    }
    if (moneyAdd < 0 || moneyAdd > 5000) {
      console.log(`⚠️ Skipping ${studentId}: moneyAdd out of range (${moneyAdd})`);
      continue;
    }

    const gradeId = normalizeId(gradeRaw === "K" ? "k" : gradeRaw);
    const homeroomId = normalizeId(homeroomRaw);

    const studentRef = db
      .collection("schools").doc(SCHOOL_DOC_ID)
      .collection("grades").doc(gradeId)
      .collection("homerooms").doc(homeroomId)
      .collection(STUDENT_COLLECTION_NAME).doc(studentId);

    const updates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      "readathon.lastUpdatedAt": admin.firestore.FieldValue.serverTimestamp()
    };

    // ✅ Only EVER touch EARNED fields
    if (minutesAdd !== 0) updates["readathon.minutesRead"] = admin.firestore.FieldValue.increment(minutesAdd);
    if (sparksAdd !== 0) updates["readathon.sparksEarned"] = admin.firestore.FieldValue.increment(sparksAdd);
    if (moneyAdd !== 0) updates["readathon.moneyRaised"] = admin.firestore.FieldValue.increment(moneyAdd);

    batch.set(studentRef, updates, { merge: true });
    writes++;

    if (writes >= 450) {
      console.log("⚠️ Hit 450 writes in one batch; stopping for safety.");
      break;
    }
  }

  await batch.commit();
  console.log(`✅ Applied deltas to ${writes} student docs (earned fields only).`);
}

main().catch(err => {
  console.log("❌ Upload failed:", err);
  process.exit(1);
});
