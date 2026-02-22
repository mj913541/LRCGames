/* functions/index.js (Node 20) */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");

// ✅ NEW (you installed this): CORS helper for upcoming HTTP endpoints
const cors = require("cors")({ origin: true });

admin.initializeApp();
const db = admin.firestore();

function schoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

function inferRole(userId, userDocRole) {
  const fromDoc = (userDocRole || "").toString().toLowerCase();
  if (["student", "staff", "admin"].includes(fromDoc)) return fromDoc;

  const id = (userId || "").toLowerCase();
  if (id.startsWith("student_")) return "student";
  if (id.startsWith("staff_")) return "staff";
  if (id.startsWith("admin_")) return "admin";
  return "student";
}

function requireAuth(ctx) {
  if (!ctx.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  return ctx.auth;
}

function requireSchoolMatch(dataSchoolId, claims) {
  if (!dataSchoolId || !claims?.schoolId) {
    throw new functions.https.HttpsError("failed-precondition", "Missing schoolId.");
  }
  if (dataSchoolId !== claims.schoolId) {
    throw new functions.https.HttpsError("permission-denied", "School mismatch.");
  }
}

function todayDateKey() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function isLinkedStaffToStudent({ schoolId, staffId, studentId }) {
  const linkId = `${staffId}_${studentId}`;
  const ref = db.doc(`${schoolRoot(schoolId)}/staffStudentLinks/${linkId}`);
  const snap = await ref.get();
  return snap.exists && snap.data()?.active === true;
}

async function getCanAwardHomerooms({ schoolId, staffId }) {
  const ref = db.doc(`${schoolRoot(schoolId)}/users/${staffId}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return snap.data()?.canAwardHomerooms ?? null;
}

/**
 * Callable: verifyPin({schoolId, userId, pin})
 * - checks users/{userId}.active
 * - compares secrets/{userId}.pinHash via bcrypt
 * - returns customToken with claims: {schoolId, userId, role}
 */
exports.verifyPin = functions.https.onCall(async (data, context) => {
  try {
    const payload =
      data && typeof data === "object" && data.data && typeof data.data === "object"
        ? data.data
        : data;

    const schoolId = String(payload?.schoolId ?? "").trim();
    const userId = String(payload?.userId ?? "").trim().toLowerCase();
    const pin = String(payload?.pin ?? "").trim();

    console.log("verifyPin (safe) inputs:", {
      schoolId,
      userId,
      pinLen: pin.length,
      hasAuth: !!context?.auth,
    });

    if (!schoolId || !userId || !/^\d{4}$/.test(pin)) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        `Invalid schoolId/userId/pin. schoolIdLen=${schoolId.length} userIdLen=${userId.length} pinLen=${pin.length}`
      );
    }

    const userRef = db.doc(`${schoolRoot(schoolId)}/users/${userId}`);
    const userSnap = await userRef.get();

    console.log("verifyPin userSnap.exists:", userSnap.exists);

    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "User not found.");
    const userData = userSnap.data() || {};

    console.log("verifyPin userData.active:", userData.active);

    if (userData.active !== true) throw new functions.https.HttpsError("failed-precondition", "User inactive.");

    const secRef = db.doc(`${schoolRoot(schoolId)}/secrets/${userId}`);
    const secSnap = await secRef.get();

    console.log("verifyPin secSnap.exists:", secSnap.exists);

    if (!secSnap.exists) throw new functions.https.HttpsError("not-found", "PIN not set.");
    const pinHash = secSnap.data()?.pinHash;

    console.log("verifyPin pinHash type/len:", {
      type: typeof pinHash,
      len: typeof pinHash === "string" ? pinHash.length : null,
    });

    if (typeof pinHash !== "string" || pinHash.length < 10) {
      throw new functions.https.HttpsError("failed-precondition", "PIN hash invalid (reset PIN).");
    }

    const ok = await bcrypt.compare(pin, pinHash);
    console.log("verifyPin bcrypt ok:", ok);

    if (!ok) throw new functions.https.HttpsError("permission-denied", "Invalid PIN.");

    const role = inferRole(userId, userData.role);

    const customToken = await admin.auth().createCustomToken(userId, {
      schoolId,
      userId,
      role,
    });

    console.log("verifyPin token created. role:", role);

    return { customToken, role };
  } catch (err) {
    if (err instanceof functions.https.HttpsError) throw err;

    console.error("verifyPin INTERNAL crash:", err);
    throw new functions.https.HttpsError(
      "internal",
      err?.message ? `verifyPin crashed: ${err.message}` : "verifyPin crashed (internal error)."
    );
  }
});

/**
 * Callable: submitTransaction({...})
 */
exports.submitTransaction = functions.https.onCall(async (data, context) => {
console.log("submitTransaction HIT", {
  hasAuth: !!context.auth,
  uid: context.auth?.uid,
  hasRawReq: !!context.rawRequest,
  hasAuthHeader: !!context.rawRequest?.headers?.authorization,
  hasAppCheckHeader: !!context.rawRequest?.headers?.["x-firebase-appcheck"],
  origin: context.rawRequest?.headers?.origin,
});
  const auth = requireAuth(context);
  const claims = auth.token || {};
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const submittedByUserId = String(claims.userId || auth.uid || "").toLowerCase();
  const role = String(claims.role || "").toLowerCase();

  const targetUserId = String(data?.targetUserId ?? "").trim().toLowerCase();
  const actionType = String(data?.actionType ?? "").trim();

  const deltaMinutes = Number(data?.deltaMinutes || 0);
  const deltaRubies = Number(data?.deltaRubies || 0);
  const deltaMoneyRaisedCents = Number(data?.deltaMoneyRaisedCents || 0);

  const note = (data?.note || "").toString().slice(0, 300);
  const dateKey = (data?.dateKey || todayDateKey()).toString();

  if (!targetUserId || !actionType) {
    throw new functions.https.HttpsError("invalid-argument", "Missing targetUserId/actionType.");
  }

  // Permission checks
  if (role === "student") {
    if (targetUserId !== submittedByUserId) {
      throw new functions.https.HttpsError("permission-denied", "Students can submit for self only.");
    }
  } else if (role === "staff") {
    if (targetUserId !== submittedByUserId) {
      const linked = await isLinkedStaffToStudent({
        schoolId,
        staffId: submittedByUserId,
        studentId: targetUserId,
      });
      if (!linked) throw new functions.https.HttpsError("permission-denied", "Not linked to that student.");
    }
  } else if (role === "admin") {
    // ok
  } else {
    throw new functions.https.HttpsError("permission-denied", "Unknown role.");
  }

  // Validate types
  if (!Number.isFinite(deltaMinutes) || !Number.isFinite(deltaRubies) || !Number.isFinite(deltaMoneyRaisedCents)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid numeric delta.");
  }

  const txId = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
  const txRef = db.doc(`${schoolRoot(schoolId)}/transactions/${txId}`);

  const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}/readathon/summary`);

  await db.runTransaction(async (t) => {
    // Ensure user exists & active
    const userRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}`);
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "Target user not found.");
    if (userSnap.data()?.active !== true) throw new functions.https.HttpsError("failed-precondition", "Target inactive.");

    const sumSnap = await t.get(summaryRef);
    const sum = sumSnap.exists
      ? sumSnap.data()
      : {
          minutesTotal: 0,
          minutesPendingTotal: 0,
          moneyRaisedCents: 0,
          rubiesBalance: 0,
          rubiesLifetimeEarned: 0,
          rubiesLifetimeSpent: 0,
        };

    const txData = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      dateKey,
      targetUserId,
      submittedByUserId,
      actionType,
      deltaMinutes,
      deltaRubies,
      deltaMoneyRaisedCents,
      note,
      source: "app",
    };

    if (actionType === "MINUTES_SUBMIT_PENDING") {
      txData.status = "PENDING";
      sum.minutesPendingTotal = Number(sum.minutesPendingTotal || 0) + deltaMinutes;
    } else {
      txData.status = "POSTED";

      sum.minutesTotal = Number(sum.minutesTotal || 0) + deltaMinutes;

      if (actionType === "RUBIES_AWARD" && deltaRubies > 0) {
        sum.rubiesBalance = Number(sum.rubiesBalance || 0) + deltaRubies;
        sum.rubiesLifetimeEarned = Number(sum.rubiesLifetimeEarned || 0) + deltaRubies;
      }
      if (actionType === "RUBIES_SPEND" && deltaRubies < 0) {
        sum.rubiesBalance = Number(sum.rubiesBalance || 0) + deltaRubies;
        sum.rubiesLifetimeSpent = Number(sum.rubiesLifetimeSpent || 0) + Math.abs(deltaRubies);
      }

      sum.moneyRaisedCents = Number(sum.moneyRaisedCents || 0) + deltaMoneyRaisedCents;
    }

    t.set(txRef, txData, { merge: true });
    t.set(summaryRef, sum, { merge: true });
  });

  return { ok: true, txId };
});

/**
 * Callable: approvePendingMinutes({ schoolId, txId })
 */
exports.approvePendingMinutes = functions.https.onCall(async (data, context) => {
  const auth = requireAuth(context);
  const claims = auth.token || {};
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const role = String(claims.role || "").toLowerCase();
  if (role !== "admin") throw new functions.https.HttpsError("permission-denied", "Admin only.");

  const txId = String(data?.txId ?? "").trim();
  if (!txId) throw new functions.https.HttpsError("invalid-argument", "Missing txId.");

  const pendingRef = db.doc(`${schoolRoot(schoolId)}/transactions/${txId}`);

  await db.runTransaction(async (t) => {
    const pendingSnap = await t.get(pendingRef);
    if (!pendingSnap.exists) throw new functions.https.HttpsError("not-found", "Pending tx not found.");

    const pending = pendingSnap.data() || {};
    if (pending.actionType !== "MINUTES_SUBMIT_PENDING") {
      throw new functions.https.HttpsError("failed-precondition", "Not a pending minutes tx.");
    }
    if (pending.status !== "PENDING") {
      throw new functions.https.HttpsError("failed-precondition", "Already processed.");
    }

    const targetUserId = pending.targetUserId;
    const minutes = Number(pending.deltaMinutes || 0);
    if (!targetUserId || minutes <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Invalid pending tx data.");
    }

    const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}/readathon/summary`);
    const sumSnap = await t.get(summaryRef);
    const sum = sumSnap.exists
      ? sumSnap.data()
      : {
          minutesTotal: 0,
          minutesPendingTotal: 0,
          moneyRaisedCents: 0,
          rubiesBalance: 0,
          rubiesLifetimeEarned: 0,
          rubiesLifetimeSpent: 0,
        };

    t.set(
      pendingRef,
      {
        status: "APPROVED",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedByUserId: String(claims.userId || auth.uid || "").toLowerCase(),
      },
      { merge: true }
    );

    const approvalTxId = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
    const approvalRef = db.doc(`${schoolRoot(schoolId)}/transactions/${approvalTxId}`);

    t.set(
      approvalRef,
      {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        dateKey: pending.dateKey || todayDateKey(),
        targetUserId,
        submittedByUserId: String(claims.userId || auth.uid || "").toLowerCase(),
        actionType: "MINUTES_APPROVE",
        deltaMinutes: minutes,
        deltaRubies: minutes,
        deltaMoneyRaisedCents: 0,
        note: `Approved pending tx ${txId}${pending.note ? ` • ${pending.note}` : ""}`.slice(0, 300),
        source: "approval",
        status: "POSTED",
        relatedTxId: txId,
      },
      { merge: true }
    );

    sum.minutesPendingTotal = Math.max(0, Number(sum.minutesPendingTotal || 0) - minutes);
    sum.minutesTotal = Number(sum.minutesTotal || 0) + minutes;

    sum.rubiesBalance = Number(sum.rubiesBalance || 0) + minutes;
    sum.rubiesLifetimeEarned = Number(sum.rubiesLifetimeEarned || 0) + minutes;

    t.set(summaryRef, sum, { merge: true });
  });

  return { ok: true };
});

/**
 * Callable: awardHomeroom({...})
 */
exports.awardHomeroom = functions.https.onCall(async (data, context) => {
  const auth = requireAuth(context);
  const claims = auth.token || {};
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const role = String(claims.role || "").toLowerCase();
  if (!(role === "staff" || role === "admin")) {
    throw new functions.https.HttpsError("permission-denied", "Staff/Admin only.");
  }

  const homeroomId = String(data?.homeroomId ?? "").trim();
  const deltaMinutes = Number(data?.deltaMinutes || 0);
  const deltaRubies = Number(data?.deltaRubies || 0);
  const note = (data?.note || "").toString().slice(0, 300);
  const dateKey = (data?.dateKey || todayDateKey()).toString();

  if (!homeroomId) throw new functions.https.HttpsError("invalid-argument", "Missing homeroomId.");
  if (!Number.isFinite(deltaMinutes) || !Number.isFinite(deltaRubies)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid numeric delta.");
  }
  if (deltaMinutes <= 0 && deltaRubies <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Provide minutes and/or rubies > 0.");
  }

  const actorId = String(claims.userId || auth.uid || "").toLowerCase();

  if (role === "staff") {
    const can = await getCanAwardHomerooms({ schoolId, staffId: actorId });

    let ok = false;
    if (typeof can === "string" && can.toUpperCase() === "ALL") ok = true;
    if (Array.isArray(can) && can.includes(homeroomId)) ok = true;

    if (!ok) throw new functions.https.HttpsError("permission-denied", "Not allowed to award that homeroom.");
  }

  const pubCol = db.collection(`${schoolRoot(schoolId)}/publicStudents`);
  const snap = await pubCol.where("homeroomId", "==", homeroomId).where("active", "==", true).get();

  const studentIds = snap.docs.map((d) => d.id).filter(Boolean);

  if (!studentIds.length) {
    return { ok: true, affected: 0 };
  }

  const chunks = chunkArray(studentIds, 200);
  let affected = 0;

  for (const chunk of chunks) {
    const batch = db.batch();

    for (const studentId of chunk) {
      const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${studentId}/readathon/summary`);

      const baseTx = {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        dateKey,
        targetUserId: studentId,
        submittedByUserId: actorId,
        note,
        source: "homeroom",
      };

      if (deltaMinutes > 0) {
        const txId = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
        const txRef = db.doc(`${schoolRoot(schoolId)}/transactions/${txId}`);
        batch.set(
          txRef,
          {
            ...baseTx,
            actionType: "MINUTES_SUBMIT_PENDING",
            deltaMinutes,
            deltaRubies: 0,
            deltaMoneyRaisedCents: 0,
            status: "PENDING",
            homeroomId,
          },
          { merge: true }
        );

        batch.set(
          summaryRef,
          {
            minutesPendingTotal: admin.firestore.FieldValue.increment(deltaMinutes),
          },
          { merge: true }
        );
      }

      if (deltaRubies > 0) {
        const txId2 = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
        const txRef2 = db.doc(`${schoolRoot(schoolId)}/transactions/${txId2}`);
        batch.set(
          txRef2,
          {
            ...baseTx,
            actionType: "RUBIES_AWARD",
            deltaMinutes: 0,
            deltaRubies,
            deltaMoneyRaisedCents: 0,
            status: "POSTED",
            homeroomId,
          },
          { merge: true }
        );

        batch.set(
          summaryRef,
          {
            rubiesBalance: admin.firestore.FieldValue.increment(deltaRubies),
            rubiesLifetimeEarned: admin.firestore.FieldValue.increment(deltaRubies),
          },
          { merge: true }
        );
      }

      affected += 1;
    }

    await batch.commit();
  }

  return { ok: true, affected };
});

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}