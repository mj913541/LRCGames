/**
 * uploadStaff.cjs
 *
 * Usage:
 *   node uploadStaff.cjs staff_test.csv
 *
 * CSV headers required:
 * teacherId,displayName,grade,role,pin,homeroomPath
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const admin = require("firebase-admin");

// 🔹 CHANGE THIS if your service account path is different
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const filePath = process.argv[2];

if (!filePath) {
  console.error("❌ Please provide a CSV file path.");
  console.log("Example: node uploadStaff.cjs staff_test.csv");
  process.exit(1);
}

const results = [];

fs.createReadStream(path.resolve(filePath))
  .pipe(csv())
  .on("data", (data) => {
    results.push(data);
  })
  .on("end", async () => {
    console.log(`📄 Found ${results.length} rows. Uploading...\n`);

    let success = 0;
    let fail = 0;

    for (const row of results) {
      try {
        const teacherId = (row.teacherId || "").trim();
        const displayName = (row.displayName || "").trim();
        const grade = Number(row.grade);
        const role = (row.role || "staff").trim();
        const pin = String(row.pin || "").trim();
        const homeroomPath = (row.homeroomPath || "").trim();

        if (!teacherId) {
          console.warn("⚠️ Skipping row — missing teacherId:", row);
          continue;
        }

        const staffRef = db.collection("staff").doc(teacherId);

        await staffRef.set(
          {
            teacherId,
            displayName,
            grade,
            role,
            pin,
            ...(homeroomPath ? { homeroomPath } : {}),
            active: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          },
          { merge: true }
        );

        console.log(`✅ Uploaded staff: ${teacherId}`);
        success++;
      } catch (err) {
        console.error("❌ Failed row:", row);
        console.error(err);
        fail++;
      }
    }

    console.log("\n🎉 Done.");
    console.log(`Success: ${success}`);
    console.log(`Failed: ${fail}`);
    process.exit(0);
  });
