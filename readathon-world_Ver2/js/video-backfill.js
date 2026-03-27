/**
 * VIDEO BACKFILL SCRIPT
 * ----------------------------------
 * Creates video_01 → video_16 for ALL students
 * WITHOUT overwriting existing progress
 */

const admin = require("firebase-admin");
const serviceAccount = require("C:/Users/malbr/OneDrive/Desktop/keys/lrcquest-3039e-serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const { Timestamp } = admin.firestore;

const SCHOOL_ID = "308_longbeach_elementary";

/* ----------------------------------
   VIDEO LIST (matches your app)
---------------------------------- */
const VIDEO_ITEMS = [
  { key: "video_01", title: "The Smart Cookie", youtubeId: "LJq-7-wycqY", youtubeUrl: "https://youtu.be/LJq-7-wycqY", rubies: 10, durationSeconds: 487 },
  { key: "video_02", title: "The Couch Potato", youtubeId: "qfwF75e4BYc", youtubeUrl: "https://youtu.be/qfwF75e4BYc", rubies: 10, durationSeconds: 0 },
  { key: "video_03", title: "The Sour Grape", youtubeId: "QZn1SCPtOw4", youtubeUrl: "https://youtu.be/QZn1SCPtOw4", rubies: 10, durationSeconds: 0 },
  { key: "video_04", title: "The Big Cheese", youtubeId: "8X0x7mqwJiU", youtubeUrl: "https://youtu.be/8X0x7mqwJiU", rubies: 10, durationSeconds: 0 },
  { key: "video_05", title: "We Don't Eat Our Classmates", youtubeId: "th6exRnPixg", youtubeUrl: "https://youtu.be/th6exRnPixg", rubies: 10, durationSeconds: 0 },
  { key: "video_06", title: "Knight Owl", youtubeId: "503VhkZAEfw", youtubeUrl: "https://youtu.be/503VhkZAEfw", rubies: 10, durationSeconds: 0 },
  { key: "video_07", title: "Dragons Love Tacos", youtubeId: "JYy9gbv44QE", youtubeUrl: "https://youtu.be/JYy9gbv44QE", rubies: 10, durationSeconds: 0 },
  { key: "video_08", title: "How to Catch a Snowman", youtubeId: "Xtd-mTRcu7U", youtubeUrl: "https://youtu.be/Xtd-mTRcu7U", rubies: 10, durationSeconds: 0 },
  { key: "video_09", title: "Gym Teacher from the Black Lagoon", youtubeId: "AR9oL1YfpRU", youtubeUrl: "https://youtu.be/AR9oL1YfpRU", rubies: 10, durationSeconds: 0 },
  { key: "video_10", title: "Music Teacher from the Black Lagoon", youtubeId: "7-s0hcwQOaE", youtubeUrl: "https://youtu.be/7-s0hcwQOaE", rubies: 10, durationSeconds: 0 },
  { key: "video_11", title: "Librarian from the Black Lagoon", youtubeId: "ZOZ7ExGHsCw", youtubeUrl: "https://youtu.be/ZOZ7ExGHsCw", rubies: 10, durationSeconds: 0 },
  { key: "video_12", title: "Class Pet from the Black Lagoon", youtubeId: "r54lszFx_8g", youtubeUrl: "https://youtu.be/r54lszFx_8g", rubies: 10, durationSeconds: 0 },
  { key: "video_13", title: "Pig the Star", youtubeId: "Ic_Ar31iFwA", youtubeUrl: "https://youtu.be/Ic_Ar31iFwA", rubies: 10, durationSeconds: 0 },
  { key: "video_14", title: "Pig the Stinker", youtubeId: "OSaC4JBsOjE", youtubeUrl: "https://youtu.be/OSaC4JBsOjE", rubies: 10, durationSeconds: 0 },
  { key: "video_15", title: "Pig the Winner", youtubeId: "7Zhzv3RfqGM", youtubeUrl: "https://youtu.be/7Zhzv3RfqGM", rubies: 10, durationSeconds: 0 },
  { key: "video_16", title: "Pig the Slob", youtubeId: "S5UA0LajxOE", youtubeUrl: "https://youtu.be/S5UA0LajxOE", rubies: 10, durationSeconds: 0 },
];

/* ----------------------------------
   NEW DOC STRUCTURE
---------------------------------- */
function buildNew(video) {
  return {
    completed: false,
    completedAt: null,
    durationSeconds: video.durationSeconds || 0,
    lastWatchedAt: null,
    resumeAtSeconds: 0,
    rubiesAwarded: 0,
    rubiesPlanned: video.rubies,
    suspiciousSkips: 0,
    title: video.title,
    updatedAt: Timestamp.now(),
    videoKey: video.key,
    watchPercent: 0,
    watchedSecondCount: 0,
    youtubeId: video.youtubeId,
    youtubeUrl: video.youtubeUrl,
  };
}

/* ----------------------------------
   SAFE MERGE (DOES NOT RESET PROGRESS)
---------------------------------- */
function buildMerge(video) {
  return {
    title: video.title,
    youtubeId: video.youtubeId,
    youtubeUrl: video.youtubeUrl,
    rubiesPlanned: video.rubies,
    durationSeconds: video.durationSeconds || 0,
    updatedAt: Timestamp.now(),
  };
}

/* ----------------------------------
   MAIN
---------------------------------- */
async function run() {
  console.log("🚀 Starting backfill...");

  const usersSnap = await db
    .collection("readathonV2_schools")
    .doc(SCHOOL_ID)
    .collection("users")
    .get();

  console.log(`👥 Found ${usersSnap.size} users`);

  let count = 0;

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;

    for (const video of VIDEO_ITEMS) {
      const ref = db.doc(
        `readathonV2_schools/${SCHOOL_ID}/users/${userId}/videoProgress/${video.key}`
      );

      const existing = await ref.get();

      if (existing.exists) {
        await ref.set(buildMerge(video), { merge: true });
      } else {
        await ref.set(buildNew(video), { merge: true });
      }

      count++;
    }
  }

  console.log(`✅ Done! Updated ${count} video docs`);
}

run().catch(console.error);