
const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");
// =========================================
// 1) FIREBASE SETUP
// =========================================
// Option A:
// const serviceAccount = require("./serviceAccountKey.json");
//
// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// Option B: direct absolute path if needed
// 🔐 service account
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// =========================================
// 2) CONFIG
// =========================================
const SCHOOL_ID = "308_longbeach_elementary";
const ROOT = `readathonV2_schools/${SCHOOL_ID}/users`;

// If your docs are named "video_01"..."video_16", keep this.
// If they are just "01"..."16", change this array.
const VIDEO_IDS = Array.from({ length: 16 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `video_${n}`;
});

const OUTPUT_DIR = path.join(__dirname, "exports");
const SUMMARY_CSV = path.join(OUTPUT_DIR, "video-library-summary.csv");
const DETAILS_CSV = path.join(OUTPUT_DIR, "video-library-video-details.csv");

// =========================================
// 3) HELPERS
// =========================================
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function csvEscape(value) {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Convert arrays/objects into JSON so they stay readable in CSV
  if (Array.isArray(value) || typeof value === "object") {
    str = JSON.stringify(value);
  }

  // Escape quotes
  str = str.replace(/"/g, '""');

  // Wrap everything in quotes to be safe
  return `"${str}"`;
}

function writeCsvRow(stream, values) {
  stream.write(values.map(csvEscape).join(",") + "\n");
}

function tsToIso(value) {
  if (!value) return "";
  try {
    if (typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    if (value instanceof Date) {
      return value.toISOString();
    }
    return String(value);
  } catch (err) {
    return "";
  }
}

function safeNumber(value) {
  return typeof value === "number" ? value : "";
}

function safeBool(value) {
  return typeof value === "boolean" ? value : "";
}

// =========================================
// 4) MAIN EXPORT
// =========================================
async function runExport() {
  ensureDir(OUTPUT_DIR);

  const summaryStream = fs.createWriteStream(SUMMARY_CSV, { encoding: "utf8" });
  const detailsStream = fs.createWriteStream(DETAILS_CSV, { encoding: "utf8" });

  // SUMMARY CSV HEADER
  writeCsvRow(summaryStream, [
    "userId",
    "displayName",
    "firstName",
    "lastName",
    "grade",
    "teacher",
    "completedCount",
    "completedVideos",
    "earnedRubies",
    "totalRubiesAwarded",
    "videoDocsFound",
    "videosCompletedFromProgress",
    "lastWatchedAtLatest",
  ]);

  // DETAILS CSV HEADER
  writeCsvRow(detailsStream, [
    "userId",
    "displayName",
    "firstName",
    "lastName",
    "grade",
    "teacher",
    "videoId",
    "title",
    "youtubeId",
    "youtubeUrl",
    "completed",
    "completedAt",
    "durationSeconds",
    "lastWatchedAt",
    "resumeAtSeconds",
    "rubiesAwarded",
    "rubiesPlanned",
    "suspiciousSkips",
    "updatedAt",
    "watchPercent",
    "watchedSecondCount",
  ]);

  let totalUsers = 0;
  let lastDoc = null;

  while (true) {
    let query = db.collection(ROOT).orderBy(admin.firestore.FieldPath.documentId()).limit(200);

    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const userSnap = await query.get();

    if (userSnap.empty) {
      break;
    }

    for (const userDoc of userSnap.docs) {
      totalUsers++;
      const userId = userDoc.id;
      const userData = userDoc.data() || {};

      const displayName = userData.displayName || "";
      const firstName = userData.firstName || "";
      const lastName = userData.lastName || "";
      const grade = userData.grade || "";
      const teacher = userData.teacher || userData.teacherName || "";

      // Pull videoLibrary summary doc
      const summaryRef = db.doc(`${ROOT}/${userId}/videoLibrary/summary`);

      // Pull all 16 videoProgress docs
      const progressRefs = VIDEO_IDS.map((videoId) =>
        db.doc(`${ROOT}/${userId}/videoProgress/${videoId}`)
      );

      const [summarySnap, ...progressSnaps] = await db.getAll(summaryRef, ...progressRefs);

      const summaryData = summarySnap.exists ? summarySnap.data() || {} : {};

      const completedCount = summaryData.completedCount ?? "";
      const completedVideos = Array.isArray(summaryData.completedVideos)
        ? summaryData.completedVideos
        : [];
      const earnedRubies = summaryData.earnedRubies ?? "";
      const totalRubiesAwarded = summaryData.totalRubiesAwarded ?? "";

      let videoDocsFound = 0;
      let videosCompletedFromProgress = 0;
      let latestLastWatched = "";

      for (let i = 0; i < progressSnaps.length; i++) {
        const progressSnap = progressSnaps[i];
        const videoId = VIDEO_IDS[i];

        if (!progressSnap.exists) {
          continue;
        }

        videoDocsFound++;

        const p = progressSnap.data() || {};

        if (p.completed === true) {
          videosCompletedFromProgress++;
        }

        const lastWatchedIso = tsToIso(p.lastWatchedAt);
        if (lastWatchedIso && (!latestLastWatched || lastWatchedIso > latestLastWatched)) {
          latestLastWatched = lastWatchedIso;
        }

        writeCsvRow(detailsStream, [
          userId,
          displayName,
          firstName,
          lastName,
          grade,
          teacher,
          videoId,
          p.title || "",
          p.youtubeId || "",
          p.youtubeUrl || "",
          safeBool(p.completed),
          tsToIso(p.completedAt),
          safeNumber(p.durationSeconds),
          lastWatchedIso,
          safeNumber(p.resumeAtSeconds),
          safeNumber(p.rubiesAwarded),
          safeNumber(p.rubiesPlanned),
          safeNumber(p.suspiciousSkips),
          tsToIso(p.updatedAt),
          safeNumber(p.watchPercent),
          safeNumber(p.watchedSecondCount),
        ]);
      }

      writeCsvRow(summaryStream, [
        userId,
        displayName,
        firstName,
        lastName,
        grade,
        teacher,
        completedCount,
        completedVideos.join(" | "),
        earnedRubies,
        totalRubiesAwarded,
        videoDocsFound,
        videosCompletedFromProgress,
        latestLastWatched,
      ]);

      if (totalUsers % 50 === 0) {
        console.log(`Processed ${totalUsers} users...`);
      }
    }

    lastDoc = userSnap.docs[userSnap.docs.length - 1];
  }

  summaryStream.end();
  detailsStream.end();

  console.log("==================================");
  console.log(`Done. Processed ${totalUsers} users.`);
  console.log(`Summary CSV: ${SUMMARY_CSV}`);
  console.log(`Details CSV: ${DETAILS_CSV}`);
  console.log("==================================");
}

runExport().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});