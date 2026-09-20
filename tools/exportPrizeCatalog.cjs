const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");

// 🔐 SERVICE ACCOUNT
const serviceAccount = require(
  "C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json"
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SCHOOL_ID = "308_longbeach_elementary";

async function run() {
  const snap = await db
    .collection(
      `readathonV2_schools/${SCHOOL_ID}/prizeCatalog`
    )
    .get();

  const rows = snap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  const outPath = path.join(
    __dirname,
    "../data_imports/prizeCatalog.json"
  );

  fs.writeFileSync(
    outPath,
    JSON.stringify(rows, null, 2)
  );

  console.log("DONE:", outPath);
}

run().catch(console.error);