const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

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
  return x === undefined || x === null ? "" : String(x);
}

/* =========================
   getRoster
   schools/main/grades/{gradeId}/homerooms/{homeroomId}/students/*
========================= */
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
    .sort((a, b) =>
      a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" })
    )
    .map(({ studentId, displayName }) => ({ studentId, displayName }));

  return { ok: true, students };
});

/* =========================
   verifyStudentPin
   - Reads SHA-256 pinHash from studentSecrets/{studentId}.pinHash
   - Compares to SHA-256(pin)
   - Loads roster profile from schools/main/.../students/{studentId}
   - Writes session to users/{uid}
========================= */
exports.verifyStudentPin = functions.https.onCall(async (data, context) => {
  // 🔍 TEMP DEBUG (so we can see why you're getting 401)
  console.log("verifyStudentPin auth:", context.auth);

  if (!context.auth) {
    // Returning (instead of throwing) makes debugging easier in the browser
    return { ok: false, debug: "NO_AUTH_CONTEXT" };
  }

  const uid = context.auth.uid;

  const studentId = safeString(data?.studentId).trim();
  const pin = safeString(data?.pin).trim();

  const gradeId = safeString(data?.gradeId ?? data?.grade).trim();
  const homeroomId = safeString(data?.homeroomId ?? data?.homeroom).trim();

  if (!studentId || !pin) {
    throw new functions.https.HttpsError("invalid-argument", "Missing studentId or pin.");
  }

  // 1) Read pinHash from secrets
  const secretSnap = await db.doc(`studentSecrets/${studentId}`).get();
  if (!secretSnap.exists) return { ok: false, reason: "no-secret" };

  const storedHash = safeString(secretSnap.data()?.pinHash).toLowerCase().trim();
  if (!storedHash) return { ok: false, reason: "no-hash" };

  // 2) Hash entered pin with SHA-256 hex
  const enteredHash = crypto
    .createHash("sha256")
    .update(pin, "utf8")
    .digest("hex")
    .toLowerCase();

  if (enteredHash !== storedHash) {
    return { ok: false, reason: "bad-pin" };
  }

  // 3) Load roster profile (prefer the directory doc)
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

  // Optional fallback (if you keep a top-level students collection for other features)
  if (!studentProfile) {
    const fallbackSnap = await db.doc(`students/${studentId}`).get();
    if (fallbackSnap.exists) studentProfile = fallbackSnap.data() || {};
  }

  if (!studentProfile) {
    throw new functions.https.HttpsError("not-found", "Student profile not found.");
  }

  const resolvedGrade = safeString(studentProfile.grade ?? studentProfile.gradeId ?? gradeId);
  const resolvedTeacherId = safeString(
    studentProfile.teacherId ??
      studentProfile.homeroomId ??
      homeroomId ??
      studentProfile.homeroom ??
      ""
  );

  const studentName = safeString(
    studentProfile.displayName ?? studentProfile.studentName ?? studentProfile.name ?? ""
  );

  const teacherName = safeString(
    studentProfile.teacherName ?? studentProfile.homeroomDisplayName ?? ""
  );

  // 4) Save session
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
  const minutesPerRuby =
    rulesSnap.exists && rulesSnap.data().minutesPerRuby
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

  snap.forEach((docSnap) => {
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
      batch.set(
        docSnap.ref,
        {
          rubiesBalance: balance + newRubies,
          convertedApprovedMinutes: converted + minutesConsumed,
          rubiesLastConvertedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

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
    totalMinutesConsumed,
  };
});
