/**
 * uploadStaff.cjs
 *
 * Usage:
 *   node uploadStaff.cjs staff.csv
 *
 * CSV headers required:
 * teacherId,displayName,grade,role,pin,homeroomPath
 *
 * Writes:
 *   staff/{teacherId} -> profile fields (NO PIN)
 *   staffSecrets/{teacherId} -> { pinHash }
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const admin = require("firebase-admin");
const crypto = require("crypto");

// 🔹 CHANGE THIS if your service account path/name is different
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const filePath = process.argv[2];

if (!filePath) {
  console.error("❌ Please provide a CSV file path.");
  console.log("Example: node uploadStaff.cjs staff.csv");
  process.exit(1);
}

function safeString(x) {
  return x === undefined || x === null ? "" : String(x);
}

function hashPin(pin) {
  // consistent with your functions hashing approach
  return crypto.createHash("sha256").update(pin, "utf8").digest("hex").toLowerCase();
}

const results = [];

fs.createReadStream(path.resolve(filePath))
  .pipe(csv())
  .on("data", (data) => results.push(data))
  .on("end", async () => {
    console.log(`📄 Found ${results.length} rows. Uploading staff + staffSecrets...\n`);

    let success = 0;
    let skipped = 0;
    let fail = 0;

    // Use a batch per ~400 writes (Firestore limit 500 ops/batch).
    // Each staff row does 2 writes (staff + staffSecrets), so max 200 rows per batch.
    const MAX_ROWS_PER_BATCH = 200;

    for (let i = 0; i < results.length; i += MAX_ROWS_PER_BATCH) {
      const chunk = results.slice(i, i + MAX_ROWS_PER_BATCH);
      const batch = db.batch();

      for (const row of chunk) {
        try {
          const teacherId = safeString(row.teacherId).trim().toLowerCase();
          const displayName = safeString(row.displayName).trim();
          const role = safeString(row.role).trim() || "staff";

          // grade should be numeric 6 for staff, but allow CSV values
          const gradeRaw = safeString(row.grade).trim();
          const grade = Number(gradeRaw);
          const homeroomPath = safeString(row.homeroomPath).trim();
          const pin = safeString(row.pin).trim();

          if (!teacherId) {
            console.warn("⚠️ Skipping row — missing teacherId:", row);
            skipped++;
            continue;
          }

          if (!pin) {
            console.warn(`⚠️ Skipping ${teacherId} — missing pin`);
            skipped++;
            continue;
          }

          if (!Number.isFinite(grade)) {
            console.warn(`⚠️ Skipping ${teacherId} — invalid grade:`, gradeRaw);
            skipped++;
            continue;
          }

          const staffRef = db.collection("staff").doc(teacherId);
          const secretRef = db.collection("staffSecrets").doc(teacherId);

          // staff profile doc (NO PIN)
          batch.set(
            staffRef,
            {
              teacherId,
              displayName,
              role,
              grade, // should be 6
              ...(homeroomPath ? { homeroomPath } : {}),
              active: true,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          // secret doc with hashed PIN
          batch.set(
            secretRef,
            {
              teacherId,
              pinHash: hashPin(pin),
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          success++;
        } catch (err) {
          console.error("❌ Failed row:", row);
          console.error(err);
          fail++;
        }
      }

      await batch.commit();
      console.log(`✅ Committed batch rows ${i + 1}–${Math.min(i + MAX_ROWS_PER_BATCH, results.length)}.`);
    }

    console.log("\n🎉 Done.");
    console.log(`Prepared/Uploaded: ${success}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${fail}`);
    process.exit(0);
  });
