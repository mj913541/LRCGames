/**
 * merge-video-progress-from-tsv.cjs
 *
 * Location:
 *   /LRCGames/LRCGames/tools/
 *
 * Expected TSV headers:
 *   userId    videoId
 *
 * Run:
 *   node merge-video-progress-from-tsv.cjs ./video-progress-import.tsv
 */

const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

// 🔐 YOUR SERVICE ACCOUNT (already working path)
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

// ------------------------------------
// CONFIG
// ------------------------------------
const SCHOOL_ID = "308_longbeach_elementary";
const DEFAULT_INPUT_FILE = path.resolve(__dirname, "./video-progress-import.tsv");

const DRY_RUN = false; // 🔁 set to true to preview first
const BATCH_SIZE = 400;

const UPDATE_DATA = {
  completed: true,
  rubiesAwarded: 10,
  watchPercent: 100,
};

// ------------------------------------
// FIREBASE INIT
// ------------------------------------
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();

// ------------------------------------
// HELPERS
// ------------------------------------
function parseTSV(text) {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");

  const headers = lines[0].split("\t").map((h) => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split("\t");
    const row = {};

    headers.forEach((header, index) => {
      row[header] = (values[index] || "").trim();
    });

    rows.push(row);
  }

  return rows;
}

function normalizeUserId(userId) {
  const value = String(userId || "").trim();
  if (!value) throw new Error("Missing userId");
  return value;
}

function normalizeVideoId(videoId) {
  const raw = String(videoId || "").trim();

  if (!raw) throw new Error("Missing videoId");

  // Accept flexible formats:
  // 1 → video_01
  // 01 → video_01
  // video_1 → video_01
  // video_01 → video_01
  const match =
    raw.match(/^video_(\d{1,2})$/i) ||
    raw.match(/^(\d{1,2})$/);

  if (!match) {
    throw new Error(`Invalid videoId: ${videoId}`);
  }

  const num = Number(match[1]);

  if (num < 1 || num > 16) {
    throw new Error(`videoId must be 1–16: ${videoId}`);
  }

  return `video_${String(num).padStart(2, "0")}`;
}

function buildDocRef(userId, videoId) {
  return db
    .collection("readathonV2_schools")
    .doc(SCHOOL_ID)
    .collection("users")
    .doc(userId)
    .collection("videoProgress")
    .doc(videoId);
}

async function commitInBatches(writes) {
  let total = 0;

  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const chunk = writes.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    chunk.forEach((item) => {
      batch.set(item.ref, item.data, { merge: true });
    });

    await batch.commit();
    total += chunk.length;

    console.log(`✅ Committed ${total}/${writes.length}`);
  }
}

// ------------------------------------
// MAIN
// ------------------------------------
async function main() {
  try {
    const inputFile = path.resolve(process.argv[2] || DEFAULT_INPUT_FILE);

    if (!fs.existsSync(inputFile)) {
      console.error(`❌ TSV file not found: ${inputFile}`);
      process.exit(1);
    }

    console.log(`📄 Reading: ${inputFile}`);
    const raw = fs.readFileSync(inputFile, "utf8");
    const rows = parseTSV(raw);

    const writes = [];
    const seen = new Set();

    let skipped = 0;
    let invalid = 0;

    for (const row of rows) {
      try {
        const userId = normalizeUserId(row.userId);
        const videoId = normalizeVideoId(row.videoId);

        const key = `${userId}_${videoId}`;

        if (seen.has(key)) {
          skipped++;
          continue;
        }

        seen.add(key);

        const ref = buildDocRef(userId, videoId);

        writes.push({
          ref,
          data: UPDATE_DATA,
          label: `${userId} / ${videoId}`,
        });

      } catch (err) {
        console.warn("⚠️ Skipped row:", row);
        console.warn("   Reason:", err.message);
        invalid++;
      }
    }

    console.log("");
    console.log("--------- SUMMARY ---------");
    console.log(`Rows: ${rows.length}`);
    console.log(`Valid: ${writes.length}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Invalid: ${invalid}`);
    console.log(`Dry Run: ${DRY_RUN}`);
    console.log("---------------------------");
    console.log("");

    if (DRY_RUN) {
      console.log("🔍 Preview:");
      writes.slice(0, 10).forEach((w, i) => {
        console.log(`${i + 1}. ${w.label}`);
      });
      return;
    }

    await commitInBatches(writes);

    console.log("");
    console.log("🎉 DONE! Video progress merged successfully.");

  } catch (err) {
    console.error("💥 Fatal error:");
    console.error(err);
    process.exit(1);
  }
}

main();