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

/**
 * NOTE:
 * For real PIN verification you should hash+salt and compare hashes.
 * Since I don’t know your exact hashing approach from earlier steps,
 * this supports BOTH:
 *   - stored plain pin in students/{studentId}.pin  (not recommended)
 *   - stored pinHash + pinSalt (recommended) -> you’ll plug in comparePinHash()
 */
function safeString(x) {
  return (x === undefined || x === null) ? "" : String(x);
}

/* =========================
   Roster: get students for a class
   Path:
   schools/main/grades/{grade}/homerooms/{homeroomId}/students/*
========================= */
exports.getRoster = functions.https.onCall(async (data, context) => {
  // Students will be anonymous-auth signed in before calling
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const grade = safeString(data?.grade || data?.gradeId || data?.gradeNum);
  const homeroomId = safeString(data?.homeroomId || data?.homeroom);

  if (!grade || !homeroomId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing grade or homeroom."
    );
  }

  const studentsRef = db
    .collection("schools").doc("main")
    .collection("grades").doc(grade)
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
   PIN verification: verifyStudentPin
   - checks the PIN for studentId
   - writes verified session doc to users/{uid}
========================= */

// TODO (if you use hashing): implement this based on how you created pinHash.
// For now it throws if pinHash exists, so you don't accidentally accept wrong pins.
async function comparePinHash(pin, pinHash, pinSalt) {
  // Plug in the same hashing used during bulk upload.
  // Example patterns:
  // - crypto.pbkdf2Sync(pin, salt, iterations, keylen, 'sha256').toString('hex')
  // - bcrypt.compare(pin, hash)
  throw new Error("PIN hashing compare not implemented in this snippet.");
}

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

  // 1) Load private student record (Admin SDK bypasses rules)
  const studentSnap = await db.doc(`students/${studentId}`).get();
  if (!studentSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found.");
  }
  const s = studentSnap.data() || {};

  // 2) Verify PIN
  let pinOk = false;

  // If you (temporarily) stored pin in plaintext (NOT recommended)
  if (s.pin) {
    pinOk = safeString(s.pin) === pin;
  } else if (s.pinHash && s.pinSalt) {
    // If you stored hash+salt, you MUST implement comparePinHash
    try {
      pinOk = await comparePinHash(pin, s.pinHash, s.pinSalt);
    } catch (e) {
      console.error("comparePinHash not configured:", e);
      throw new functions.https.HttpsError(
        "failed-precondition",
        "PIN hashing is enabled but compare function is not configured."
      );
    }
  } else {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No PIN data found for this student."
    );
  }

  if (!pinOk) {
    return { ok: false };
  }

  // 3) Write verified session to users/{uid}
  // Make sure these fields match your Firestore rules for minute submissions.
  const session = {
    studentId,
    grade: safeString(s.grade),
    teacherId: safeString(s.homeroomId || s.teacherId || s.homeroom || ""),
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
   Rubies conversion: convertRubies (your existing code)
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
