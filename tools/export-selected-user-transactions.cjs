// tools/export-selected-user-transactions.cjs

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// 🔐 SERVICE ACCOUNT (your working path)
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const SCHOOL_ID = "308_longbeach_elementary";

const TARGET_DISPLAY_NAMES = [
  "Samiyah Muhammad",
  "Emily Waldvogel",
  "Kai Felton",
  "Ayra Hashmi",
  "Logan Pacenti",
];

async function getUsersByDisplayNames() {
  const usersRef = db.collection("readathonV2_schools").doc(SCHOOL_ID).collection("users");
  const snapshot = await usersRef.get();

  const matchedUsers = [];
  const unmatchedNames = [];

  const normalizedTargetNames = TARGET_DISPLAY_NAMES.map((name) => name.trim().toLowerCase());

  snapshot.forEach((doc) => {
    const data = doc.data() || {};
    const displayName = String(data.displayName || "").trim();
    const normalizedDisplayName = displayName.toLowerCase();

    if (normalizedTargetNames.includes(normalizedDisplayName)) {
      matchedUsers.push({
        userId: doc.id,
        displayName,
      });
    }
  });

  for (const targetName of TARGET_DISPLAY_NAMES) {
    const found = matchedUsers.some(
      (user) => user.displayName.trim().toLowerCase() === targetName.trim().toLowerCase()
    );
    if (!found) {
      unmatchedNames.push(targetName);
    }
  }

  return { matchedUsers, unmatchedNames };
}

async function getTransactionsForUserIds(userMap) {
  const transactionsRef = db
    .collection("readathonV2_schools")
    .doc(SCHOOL_ID)
    .collection("transactions");

  const userIds = Object.keys(userMap);

  if (!userIds.length) {
    return [];
  }

  // Firestore "in" supports up to 10 values, and we only have 5 here.
  const snapshot = await transactionsRef
    .where("targetUserId", "in", userIds)
    .orderBy("timestamp", "desc")
    .get();

  const rows = [];

  snapshot.forEach((doc) => {
    const data = doc.data() || {};

    let timestampValue = "";
    if (data.timestamp && typeof data.timestamp.toDate === "function") {
      timestampValue = data.timestamp.toDate().toISOString();
    } else if (data.timestamp) {
      timestampValue = String(data.timestamp);
    }

    rows.push({
      transactionId: doc.id,
      targetDisplayName: userMap[data.targetUserId] || "",
      actionType: data.actionType ?? "",
      deltaMinutes: data.deltaMinutes ?? "",
      deltaRubies: data.deltaRubies ?? "",
      note: data.note ?? "",
      source: data.source ?? "",
      status: data.status ?? "",
      submittedByUserId: data.submittedByUserId ?? "",
      targetUserId: data.targetUserId ?? "",
      timestamp: timestampValue,
    });
  });

  return rows;
}

function escapeTsv(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\r?\n/g, " ").trim();
}

function writeJsonFile(outputPath, data) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");
}

function writeTsvFile(outputPath, rows) {
  const headers = [
    "transactionId",
    "targetDisplayName",
    "actionType",
    "deltaMinutes",
    "deltaRubies",
    "note",
    "source",
    "status",
    "submittedByUserId",
    "targetUserId",
    "timestamp",
  ];

  const lines = [
    headers.join("\t"),
    ...rows.map((row) =>
      headers.map((header) => escapeTsv(row[header])).join("\t")
    ),
  ];

  fs.writeFileSync(outputPath, lines.join("\n"), "utf8");
}

async function main() {
  try {
    console.log("Finding users by display name...");

    const { matchedUsers, unmatchedNames } = await getUsersByDisplayNames();

    if (!matchedUsers.length) {
      console.log("No matching users were found.");
      if (unmatchedNames.length) {
        console.log("Unmatched names:");
        unmatchedNames.forEach((name) => console.log(`- ${name}`));
      }
      return;
    }

    console.log(`Matched ${matchedUsers.length} user(s):`);
    matchedUsers.forEach((user) => {
      console.log(`- ${user.displayName} (${user.userId})`);
    });

    if (unmatchedNames.length) {
      console.log("\nThese display names were not found:");
      unmatchedNames.forEach((name) => console.log(`- ${name}`));
    }

    const userMap = {};
    for (const user of matchedUsers) {
      userMap[user.userId] = user.displayName;
    }

    console.log("\nPulling transactions...");
    const transactions = await getTransactionsForUserIds(userMap);

    console.log(`Found ${transactions.length} transaction(s).`);

    const outputDir = path.resolve(__dirname, "../data_imports");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonPath = path.join(outputDir, "selected_user_transactions.json");
    const tsvPath = path.join(outputDir, "selected_user_transactions.tsv");

    writeJsonFile(jsonPath, transactions);
    writeTsvFile(tsvPath, transactions);

    console.log("\nDone!");
    console.log(`JSON saved to: ${jsonPath}`);
    console.log(`TSV saved to: ${tsvPath}`);
  } catch (error) {
    console.error("Error exporting transactions:", error);
  }
}

main();