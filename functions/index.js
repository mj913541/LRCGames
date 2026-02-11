const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const db = admin.firestore();

/* =========================
   Helpers
========================= */

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

function safeString(x) {
  return (x === undefined || x === null) ? "" : String(x);
}

/* =========================
   getRoster
   Reads from:
   schools/main/grades/{grade}/homerooms/{homeroomId}/students/*
========================= */
exports.getRoster = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const grade = safeString(data?.grade || data?.gradeId || data?.gradeNum);
  const homeroomId = safeString(data?.homeroomId || data?.homeroom);

  if (!grade || !homeroomId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing grade or homeroom.");
  }

const studentsRef = db
  .collection("schools").doc("main")
  .collection("grades").doc(gradeId)
  .collection("homerooms").doc(homeroomId)
  .collection("students");


  const snap = await studentsRef.get();

  const students = snap.docs.map((d) => {
    const s = d.data() || {};
    return {
      studentId: s.studentId || d.id,
      displayName: s.displayName || s.studentName || s.name || "Student"
    };
  }).sort((a, b) => String(a.displayName).localeCompare(String(b.displayName)));

  return { ok: true, students };
});

/* =========================
   verifyStudentPin (TEMP)
   - Accepts only PIN "1111"
   - Writes session to users/{uid}
========================= */
exports.verifyStudentPin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = context.auth.uid;
  const studentId = safeString(data?.studentId);
  const pin = safeString(data?.pin);

  if (!studentId || !pin) {
    throw new functions.https.HttpsError("invalid-argument", "Missing studentId or pin.");
  }

  // TEMP PIN RULE
  if (pin !== "1111") {
    return { ok: false };
  }

  // Load private student record to build session (Admin SDK bypasses rules)
  const studentSnap = await db.doc(`students/${studentId}`).get();
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found.");
  }
  const s = studentSnap.data() || {};

  // teacherId should match what your minute rules expect (teacherId)
  // If your private student doc uses homeroomId, we map it.
  const teacherId = safeString(s.homeroomId || s.teacherId || s.homeroom || "");
  const grade = safeString(s.grade);

  const session = {
    studentId,
    grade,
    teacherId,
    studentName: safeString(s.displayName || s.studentName || s.name || ""),
    teacherName: safeString(s.teacherName || s.homeroomDisplayName || ""),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await db.doc(`users/${uid}`).set(session, { merge: true });

  return {
    ok: true,
    profile: {
      displayName: session.studentName,
      grade: session.grade,
      teacherId: session.teacherId
    }
  };
});

/* =========================
   convertRubies (your existing)
========================= */
exports.convertRubies = functions.https.onCall(async (data, context) => {
  await requireAdmin(context);

  const teacherId = (data && data.teacherId) ? String(data.teacherId) : null;
  const dryRun = !!(data && data.dryRun);

  const rulesSnap = await db.doc("config/rules").get();
  const minutesPerRuby = rulesSnap.exists && rulesSnap.data().minutesPerRuby
    ? Number(rulesSnap.data().minutesPerRuby)
    : 10;

  if (!Number.isFinite(minutesPerRuby) || minutesPerRuby <= 0) {
    throw new functions.https.HttpsError("failed-precondition", "Invalid minutesPerRuby.");
  }

  let q = db.collection("students");
  if (teacherId) q = q.where("teacherId", "==", teacherId);
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

  if (!dryRun) await batch.commit();

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
