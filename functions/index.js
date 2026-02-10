const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

async function requireAdmin(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const uid = context.auth.uid;
  const adminDoc = await db.doc(`admins/${uid}`).get();
  if (!adminDoc.exists) {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }
  return uid;
}

exports.convertRubies = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const teacherId = (data && data.teacherId) ? String(data.teacherId) : null; // optional filter
  const dryRun = !!(data && data.dryRun);

  // Load conversion rule
  const rulesSnap = await db.doc("config/rules").get();
  const minutesPerRuby = rulesSnap.exists && rulesSnap.data().minutesPerRuby
    ? Number(rulesSnap.data().minutesPerRuby)
    : 10;

  if (!Number.isFinite(minutesPerRuby) || minutesPerRuby <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Invalid minutesPerRuby.");
  }

  // Query students (optionally by teacherId)
  let q = db.collection("students");
  if (teacherId) q = q.where("teacherId", "==", teacherId);

  // Keep callable fast: cap per run (you can run multiple times)
  q = q.limit(400);

  const snap = await q.get();

  let scanned = 0;
  let updated = 0;
  let totalRubiesAdded = 0;
  let totalMinutesConsumed = 0;

  const batch = db.batch();

  snap.forEach(docSnap => {
    scanned++;
    const s = docSnap.data() || {};

    const approved = Number(s.totalApprovedMinutes || 0);
    const converted = Number(s.convertedApprovedMinutes || 0);
    const balance = Number(s.rubiesBalance || 0);

    const newMinutes = approved - converted;
    if (!Number.isFinite(newMinutes) || newMinutes < minutesPerRuby) return;

    const newRubies = Math.floor(newMinutes / minutesPerRuby);
    const minutesConsumed = newRubies * minutesPerRuby;

    if (newRubies <= 0) return;

    updated++;
    totalRubiesAdded += newRubies;
    totalMinutesConsumed += minutesConsumed;

    if (!dryRun) {
      batch.set(docSnap.ref, {
        rubiesBalance: balance + newRubies,
        convertedApprovedMinutes: converted + minutesConsumed,
        rubiesLastConvertedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Optional: append an audit log entry
      const logRef = db.collection("conversionLogs").doc();
      batch.set(logRef, {
        studentId: docSnap.id,
        teacherId: s.teacherId || null,
        approvedBefore: approved,
        convertedBefore: converted,
        rubiesAdded: newRubies,
        minutesConsumed,
        minutesPerRuby,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
  });

  if (!dryRun) {
    await batch.commit();
  }

  return {
    ok: true,
    dryRun,
    teacherId: teacherId || null,
    minutesPerRuby,
    scanned,
    studentsUpdated: updated,
    totalRubiesAdded,
    totalMinutesConsumed
  };
});
