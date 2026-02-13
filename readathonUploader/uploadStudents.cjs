/**
 * Upload roster + secrets from CSV
 * CSV headers:
 * displayName,grade,homeroom,studentId,pin
 *
 * This script assumes:
 * students.csv
 * serviceAccountKey.json
 * are in the SAME folder as this file.
 */

const fs = require("fs");
const admin = require("firebase-admin");

// SAME FOLDER FILES
const serviceAccount = require("./serviceAccountKey.json");
const CSV_FILE = "./students.csv";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

/* --------------------------
   Helper Functions
-------------------------- */

function slugify(x) {
  return String(x || "")
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const delimiter = lines[0].includes("\t") ? "\t" : ",";

  const headers = lines[0].split(delimiter).map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (cols[idx] || "").trim();
    });
    rows.push(row);
  }

  return { headers, rows };
}

/* --------------------------
   Main Upload
-------------------------- */

async function run() {
  if (!fs.existsSync(CSV_FILE)) {
    console.error("❌ students.csv not found.");
    process.exit(1);
  }

  const text = fs.readFileSync(CSV_FILE, "utf8");
  const { headers, rows } = parseCSV(text);

  const required = ["displayName", "grade", "homeroom", "studentId", "pin"];
  const missing = required.filter(h => !headers.includes(h));
  if (missing.length) {
    console.error("❌ Missing headers:", missing.join(", "));
    console.error("Found:", headers);
    process.exit(1);
  }

  console.log(`Loaded ${rows.length} students.`);

  const chunkSize = 250;
  let totalRoster = 0;
  let totalSecrets = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const batch = db.batch();
    const chunk = rows.slice(i, i + chunkSize);

    chunk.forEach((r, index) => {
      const displayName = r.displayName;
      const gradeId = String(r.grade);
      const homeroomId = slugify(r.homeroom);
      const studentId = r.studentId;
      const pin = r.pin;

      if (!displayName || !gradeId || !homeroomId || !studentId || !pin) {
        console.warn(`Skipping row ${i + index + 2} (missing data)`);
        return;
      }

      // ROSTER (safe fields only)
      const rosterRef = db
        .collection("schools").doc("main")
        .collection("grades").doc(gradeId)
        .collection("homerooms").doc(homeroomId)
        .collection("students").doc(studentId);

      batch.set(rosterRef, {
        displayName,
        studentId,
        gradeId,
        homeroomId,
        active: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      totalRoster++;

      // SECRET PIN DOC
      const secretRef = db.collection("studentSecrets").doc(studentId);

      batch.set(secretRef, {
        pin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      totalSecrets++;
    });

    await batch.commit();
    console.log(`Committed batch ${i + 1} - ${i + chunk.length}`);
  }

  console.log("✅ DONE");
  console.log("Roster docs written:", totalRoster);
  console.log("Secret docs written:", totalSecrets);
}

run().catch(err => {
  console.error("Upload failed:", err);
});
