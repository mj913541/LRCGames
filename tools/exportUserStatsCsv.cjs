const fs = require("fs");
const admin = require("firebase-admin");

// 🔐 service account
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

function csvEscape(value) {
  const s = String(value ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

async function main() {
  const schoolId = "308_longbeach_elementary";

  const usersSnap = await db
    .collection("readathonV2_schools")
    .doc(schoolId)
    .collection("users")
    .get();

  const headers = [
    "userId",
    "displayName",
    "role",
    "minutesPendingTotal",
    "minutesTotal",
    "moneyRaisedCents",
    "rubiesBalance",
    "rubiesLifetimeEarned",
    "rubiesLifetimeSpent",
    "inventoryItems",
  ];

  const lines = [headers.join(",")];

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const userData = userDoc.data() || {};

    /* ---------------------------
       READ SUMMARY
    --------------------------- */

    const summaryRef = db
      .collection("readathonV2_schools")
      .doc(schoolId)
      .collection("users")
      .doc(userId)
      .collection("readathon")
      .doc("summary");

    const summarySnap = await summaryRef.get();
    const summary = summarySnap.exists ? summarySnap.data() : {};

    /* ---------------------------
       READ INVENTORY SUBCOLLECTION
       PATH:
       /users/{userId}/readathon/summary/inventory/{itemId}
    --------------------------- */

    const inventorySnap = await summaryRef.collection("inventory").get();

    const inventoryIds = inventorySnap.docs.map((d) => d.id);
    const inventoryString = inventoryIds.join("|");

    /* ---------------------------
       BUILD CSV ROW
    --------------------------- */

    const row = [
      userId,
      userData.displayName || "",
      userData.role || "",
      summary.minutesPendingTotal ?? 0,
      summary.minutesTotal ?? 0,
      summary.moneyRaisedCents ?? 0,
      summary.rubiesBalance ?? 0,
      summary.rubiesLifetimeEarned ?? 0,
      summary.rubiesLifetimeSpent ?? 0,
      inventoryString,
    ];

    lines.push(row.map(csvEscape).join(","));
  }

  fs.writeFileSync("user-stats.csv", lines.join("\n"), "utf8");

  console.log("✅ Export complete → user-stats.csv");
}

main().catch((err) => {
  console.error("❌ Export failed");
  console.error(err);
});