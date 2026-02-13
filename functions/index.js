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

function safeString(x) {
  return x === undefined || x === null ? "" : String(x);
}


exports.getRoster = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const gradeId = safeString(data?.gradeId ?? data?.grade ?? data?.gradeNum);
  const homeroomId = safeString(data?.homeroomId ?? data?.homeroom);

  if (!gradeId || !homeroomId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing gradeId or homeroomId."
    );
  }

  const studentsRef = db
    .collection("schools").doc("main")
    .collection("grades").doc(gradeId)
    .collection("homerooms").doc(homeroomId)
    .collection("students");

  const snap = await studentsRef.get();

  const students = snap.docs
    .map((d) => {
      const s = d.data() || {};
      return {
        studentId: safeString(s.studentId || d.id),
        displayName: safeString(s.displayName || s.studentName || s.name || "Student"),
        active: s.active !== false, // treat missing as active
      };
    })
    .filter((s) => s.active)
    .sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }))
    .map(({ studentId, displayName }) => ({ studentId, displayName }));

  return { ok: true, students };
});

/* =========================
   verifyStudentPin
   - Reads PIN from: studentSecrets/{studentId}
   - Reads roster/profile from:
       schools/main/grades/{gradeId}/homerooms/{homeroomId}/students/{studentId}
     (fallback: students/{studentId})
   - Writes session to: users/{uid}
========================= */
exports.verifyStudentPin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const uid = context.auth.uid;

  const studentId = safeString(data?.studentId);
  const pin = safeString(data?.pin);

  // We strongly prefer these so we can build a clean session from the directory
  const gradeId = safeString(data?.gradeId ?? data?.grade);
  const homeroomId = safeString(data?.homeroomId ?? data?.homeroom);

  if (!studentId || !pin) {
    throw new functions.https.HttpsError("invalid-argument", "Missing studentId or pin.");
  }

  // 1) Check secret PIN (Admin SDK bypasses rules)
  const secretSnap = await db.doc(`studentSecrets/${studentId}`).get();
  if (!secretSnap.exists) {
    return { ok: false, reason: "no-secret" };
  }

  const realPin = safeString(secretSnap.data()?.pin).trim();
  if (!realPin || pin.trim() !== realPin) {
    return { ok: false, reason: "bad-pin" };
  }

  // 2) Load profile info (prefer the directory doc)
  let studentProfile = null;

  if (gradeId && homeroomId) {
    const rosterRef = db
      .collection("schools").doc("main")
      .collection("grades").doc(gradeId)
      .collection("homerooms").doc(homeroomId)
      .collection("students").doc(studentId);

    const rosterSnap = await rosterRef.get();
    if (rosterSnap.exists) studentProfile = rosterSnap.data() || {};
  }

  // Fallback: if you still have a top-level students collection used by readathon
  if (!studentProfile) {
    const fallbackSnap = await db.doc(`students/${studentId}`).get();
    if (fallbackSnap.exists) studentProfile = fallbackSnap.data() || {};
  }

  if (!studentProfile) {
    throw new functions.https.HttpsError("not-found", "Student profile not found.");
  }

  const resolvedGrade = safeString(studentProfile.grade ?? gradeId);
  const resolvedTeacherId = safeString(
    studentProfile.teacherId ??
    studentProfile.homeroomId ??
    homeroomId ??
    studentProfile.homeroom ??
    ""
  );

  const studentName = safeString(
    studentProfile.displayName ??
    studentProfile.studentName ??
    studentProfile.name ??
    ""
  );

  const teacherName = safeString(
    studentProfile.teacherName ??
    studentProfile.homeroomDisplayName ??
    ""
  );

  // 3) Write session to users/{uid}
  const session = {
    studentId,
    grade: resolvedGrade,
    teacherId: resolvedTeacherId,
    studentName,
    teacherName,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await db.doc(`users/${uid}`).set(session, { merge: true });

  return {
    ok: true,
    profile: {
      displayName: studentName,
      grade: resolvedGrade,
      teacherId: resolvedTeacherId,
    },
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
