const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf8").digest("hex");
}

// Callable: returns roster for a grade + homeroom (no PIN info)
exports.getRoster = functions.https.onCall(async (data) => {
  const grade = (data?.grade ?? "").toString().trim();
  const homeroom = (data?.homeroom ?? "").toString().trim();

  if (!grade || !homeroom) {
    throw new functions.https.HttpsError("invalid-argument", "Missing grade or homeroom.");
  }

  const snap = await db
    .collection("students")
    .where("grade", "==", grade)
    .where("homeroom", "==", homeroom)
    .where("active", "==", true)
    .get();

  const students = snap.docs.map((d) => {
    const s = d.data();
    return {
      studentId: s.studentId || d.id,
      displayName: s.displayName || "Student",
    };
  });

  students.sort((a, b) => a.displayName.localeCompare(b.displayName));
  return { students };
});

// Callable: verifies PIN, then writes users/{uid}
exports.verifyStudentPin = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Please sign in first.");
  }

  const studentId = (data?.studentId ?? "").toString().trim();
  const pin = (data?.pin ?? "").toString().trim();

  if (!studentId || !/^\d{3,6}$/.test(pin)) {
    throw new functions.https.HttpsError("invalid-argument", "Bad studentId or PIN.");
  }

  const ref = db.collection("students").doc(studentId);
  const docSnap = await ref.get();

  if (!docSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Student not found.");
  }

  const s = docSnap.data();
  if (!s.active) {
    throw new functions.https.HttpsError("failed-precondition", "This student is not active.");
  }

  const salt = s.pinSalt;
  const expectedHash = s.pinHash;
  if (!salt || !expectedHash) {
    throw new functions.https.HttpsError("failed-precondition", "PIN not set for this student.");
  }

  const computed = sha256Hex(`${salt}:${pin}`);
  if (computed !== expectedHash) {
    throw new functions.https.HttpsError("permission-denied", "That PIN didn’t match. Try again!");
  }

  const uid = context.auth.uid;
  await db.collection("users").doc(uid).set(
    {
      uid,
      studentId: s.studentId || studentId,
      displayName: s.displayName || "Student",
      grade: s.grade || "",
      homeroom: s.homeroom || "",
      role: "student",
      rubies: admin.firestore.FieldValue.increment(0),
      minutesApproved: admin.firestore.FieldValue.increment(0),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  return {
    ok: true,
    profile: {
      displayName: s.displayName || "Student",
      grade: s.grade || "",
      homeroom: s.homeroom || "",
      studentId: s.studentId || studentId,
    },
  };
});
