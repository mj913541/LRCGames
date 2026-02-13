// Converts studentSecrets/{studentId}.pin (plain) -> pinHash (sha256 hex) and deletes pin

const admin = require("firebase-admin");
const crypto = require("crypto");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function sha256Hex(s) {
  return crypto.createHash("sha256").update(String(s), "utf8").digest("hex");
}

async function run() {
  const snap = await db.collection("studentSecrets").get();
  console.log("studentSecrets docs found:", snap.size);

  let scanned = 0;
  let updated = 0;
  let skipped = 0;

  let batch = db.batch();
  let ops = 0;

  for (const doc of snap.docs) {
    scanned++;
    const data = doc.data() || {};

    const pin = (data.pin ?? "").toString().trim();
    const existingHash = (data.pinHash ?? "").toString().trim();

    // If already has pinHash, skip
    if (existingHash) {
      skipped++;
      continue;
    }

    // If no pin to convert, skip
    if (!pin) {
      skipped++;
      continue;
    }

    const pinHash = sha256Hex(pin);

    batch.set(
      doc.ref,
      {
        pinHash,
        pin: FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    updated++;
    ops++;

    if (ops >= 450) {
      await batch.commit();
      console.log("Committed batch...");
      batch = db.batch();
      ops = 0;
    }
  }

  if (ops > 0) {
    await batch.commit();
    console.log("Committed final batch...");
  }

  console.log("✅ DONE");
  console.log({ scanned, updated, skipped });
}

run().catch((e) => {
  console.error("Failed:", e);
  process.exit(1);
});
