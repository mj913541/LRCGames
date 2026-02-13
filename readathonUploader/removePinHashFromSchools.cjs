const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

async function run() {
  const gradesSnap = await db
    .collection("schools").doc("main")
    .collection("grades")
    .get();

  console.log("Grades found:", gradesSnap.size);

  let scanned = 0;
  let updated = 0;

  let batch = db.batch();
  let ops = 0;

  for (const gradeDoc of gradesSnap.docs) {
    const gradeId = gradeDoc.id;

    const homeroomsSnap = await db
      .collection("schools").doc("main")
      .collection("grades").doc(gradeId)
      .collection("homerooms")
      .get();

    for (const hrDoc of homeroomsSnap.docs) {
      const homeroomId = hrDoc.id;

      const studentsSnap = await db
        .collection("schools").doc("main")
        .collection("grades").doc(gradeId)
        .collection("homerooms").doc(homeroomId)
        .collection("students")
        .get();

      for (const sDoc of studentsSnap.docs) {
        scanned++;
        const data = sDoc.data() || {};

        if (data.pinHash !== undefined) {
          batch.update(sDoc.ref, { pinHash: FieldValue.delete() });
          updated++;
          ops++;

          // batch safety
          if (ops >= 450) {
            await batch.commit();
            console.log("Committed batch...");
            batch = db.batch();
            ops = 0;
          }
        }
      }
    }
  }

  if (ops > 0) {
    await batch.commit();
    console.log("Committed final batch...");
  }

  console.log("✅ DONE");
  console.log("Roster docs scanned:", scanned);
  console.log("pinHash removed:", updated);
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
