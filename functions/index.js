/* functions/index.js (Node 20) */
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const { onSchedule } = require("firebase-functions/v2/scheduler");

// ✅ CORS for HTTP endpoints (does NOT affect onCall functions)
const cors = require("cors")({ origin: true });

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

/* --------------------------------------------------
   Paths + Helpers
-------------------------------------------------- */

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
  if (!ctx.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
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
 * ✅ Verify Firebase ID token from Authorization: Bearer <token>
 */
async function verifyBearerToken(req) {
  const h = req.headers.authorization || "";
  const m = h.match(/^Bearer (.+)$/);
  if (!m) {
    throw new functions.https.HttpsError("unauthenticated", "Missing Bearer token.");
  }
  const decoded = await admin.auth().verifyIdToken(m[1], true);
  return decoded; // includes custom claims too
}

/**
 * ✅ Convert HttpsError to a reasonable HTTP status
 */
function httpsErrorToStatus(err) {
  const code = err?.code;
  if (code === "unauthenticated") return 401;
  if (code === "permission-denied") return 403;
  if (code === "not-found") return 404;
  if (code === "invalid-argument") return 400;
  if (code === "failed-precondition") return 412;
  if (code === "already-exists") return 409;
  return 500;
}

/* --------------------------------------------------
   Utility
-------------------------------------------------- */

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Public-facing name: "First L."
 * - "Evelyn Lewis" => "Evelyn L."
 * - "Evelyn" => "Evelyn"
 * - "Evelyn Marie Lewis" => "Evelyn L."
 */
function toPublicName(displayName) {
  const raw = (displayName || "").toString().trim();
  if (!raw) return "";
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const last = parts[parts.length - 1];
  const initial = last[0] ? `${last[0].toUpperCase()}.` : "";
  return initial ? `${first} ${initial}` : first;
}

function defaultSummary() {
  return {
    minutesTotal: 0,
    minutesPendingTotal: 0,
    moneyRaisedCents: 0,
    rubiesBalance: 0,
    rubiesLifetimeEarned: 0,
    rubiesLifetimeSpent: 0,
  };
}

function normalizeCatalogSlot(raw = {}) {
  const slot = String(
    raw.slot || raw.category || raw.type || raw.itemType || raw.kind || ""
  )
    .trim()
    .toLowerCase();

  const subslot = String(
    raw.subslot || raw.layer || raw.equipLayer || raw.wearableType || ""
  )
    .trim()
    .toLowerCase();

  const s = `${slot} ${subslot} ${String(raw.roomLayer || "").toLowerCase()}`;

  if (s.includes("background")) return "background";
  if (s.includes("pet")) return "pet";
  if (s.includes("wall")) return "wall";
  if (s.includes("floor")) return "floor";
  if (s.includes("base")) return "base";
  if (s.includes("body")) return "base";
  if (s.includes("avatar")) return "base";
  if (s.includes("head")) return "head";
  if (s.includes("hair")) return "head";
  if (s.includes("hat")) return "head";
  if (s.includes("face")) return "head";
  if (s.includes("accessory")) return "accessory";
  if (s.includes("glasses")) return "accessory";
  if (s.includes("prop")) return "accessory";
  if (s.includes("wearable")) return "accessory";

  return slot || "accessory";
}

/* --------------------------------------------------
   Shared Core: submitTransaction
-------------------------------------------------- */

async function submitTransactionCore(data, claims, authUid) {
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const submittedByUserId = String(claims.userId || authUid || "").toLowerCase();
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
    // ✅ Staff can submit pending minutes for themselves OR any student.
    if (actionType !== "MINUTES_SUBMIT_PENDING") {
      throw new functions.https.HttpsError("permission-denied", "Staff can only submit pending minutes.");
    }

    if (Number(deltaRubies) !== 0 || Number(deltaMoneyRaisedCents) !== 0) {
      throw new functions.https.HttpsError("permission-denied", "Staff cannot submit rubies or money.");
    }

    if (!Number.isFinite(deltaMinutes) || deltaMinutes <= 0 || deltaMinutes > 600) {
      throw new functions.https.HttpsError("invalid-argument", "Minutes must be between 1 and 600.");
    }
  } else if (role === "admin") {
    // ok
  } else {
    throw new functions.https.HttpsError("permission-denied", "Unknown role.");
  }

  const txId = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
  const txRef = db.doc(`${schoolRoot(schoolId)}/transactions/${txId}`);
  const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}/readathon/summary`);

  await db.runTransaction(async (t) => {
    const userRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}`);
    const userSnap = await t.get(userRef);
    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Target user not found.");
    }
    if (userSnap.data()?.active !== true) {
      throw new functions.https.HttpsError("failed-precondition", "Target inactive.");
    }

    const sumSnap = await t.get(summaryRef);
    const sum = sumSnap.exists ? sumSnap.data() : defaultSummary();

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
}

/* --------------------------------------------------
   Shared Core: awardHomeroom
-------------------------------------------------- */

async function awardHomeroomCore(data, claims, authUid) {
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

  if (!homeroomId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing homeroomId.");
  }
  if (!Number.isFinite(deltaMinutes) || !Number.isFinite(deltaRubies)) {
    throw new functions.https.HttpsError("invalid-argument", "Invalid numeric delta.");
  }
  if (deltaMinutes <= 0 && deltaRubies <= 0) {
    throw new functions.https.HttpsError("invalid-argument", "Provide minutes and/or rubies > 0.");
  }

  const actorId = String(claims.userId || authUid || "").toLowerCase();

  if (role === "staff") {
    const can = await getCanAwardHomerooms({ schoolId, staffId: actorId });

    let ok = false;
    if (typeof can === "string" && can.toUpperCase() === "ALL") ok = true;
    if (Array.isArray(can) && can.includes(homeroomId)) ok = true;

    if (!ok) {
      throw new functions.https.HttpsError("permission-denied", "Not allowed to award that homeroom.");
    }
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
          { minutesPendingTotal: admin.firestore.FieldValue.increment(deltaMinutes) },
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
}

/* --------------------------------------------------
   Shared Core: approvePendingMinutes
-------------------------------------------------- */

async function approvePendingMinutesCore(data, claims, authUid) {
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const role = String(claims.role || "").toLowerCase();
  if (role !== "admin") {
    throw new functions.https.HttpsError("permission-denied", "Admin only.");
  }

  const txId = String(data?.txId ?? "").trim();
  if (!txId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing txId.");
  }

  const pendingRef = db.doc(`${schoolRoot(schoolId)}/transactions/${txId}`);
  const approvedByUserId = String(claims.userId || authUid || "").toLowerCase();

  let approvalTxId = null;

  await db.runTransaction(async (t) => {
    const pendingSnap = await t.get(pendingRef);
    if (!pendingSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Pending tx not found.");
    }

    const pending = pendingSnap.data() || {};
    if (pending.actionType !== "MINUTES_SUBMIT_PENDING") {
      throw new functions.https.HttpsError("failed-precondition", "Not a pending minutes tx.");
    }
    if (pending.status !== "PENDING") {
      throw new functions.https.HttpsError("failed-precondition", "Already processed.");
    }

    const targetUserId = String(pending.targetUserId || "").toLowerCase();
    const minutes = Number(pending.deltaMinutes || 0);
    if (!targetUserId || minutes <= 0) {
      throw new functions.https.HttpsError("failed-precondition", "Invalid pending tx data.");
    }

    const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${targetUserId}/readathon/summary`);
    const sumSnap = await t.get(summaryRef);
    const sum = sumSnap.exists ? sumSnap.data() : defaultSummary();

    t.set(
      pendingRef,
      {
        status: "APPROVED",
        approvedAt: admin.firestore.FieldValue.serverTimestamp(),
        approvedByUserId,
      },
      { merge: true }
    );

    approvalTxId = db.collection(`${schoolRoot(schoolId)}/transactions`).doc().id;
    const approvalRef = db.doc(`${schoolRoot(schoolId)}/transactions/${approvalTxId}`);

    t.set(
      approvalRef,
      {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        dateKey: pending.dateKey || todayDateKey(),
        targetUserId,
        submittedByUserId: approvedByUserId,
        actionType: "MINUTES_APPROVE",
        deltaMinutes: minutes,
        deltaRubies: minutes, // rubies awarded 1:1
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

  return { ok: true, approvalTxId };
}

/* --------------------------------------------------
   Shared Core: buyAvatarItem
-------------------------------------------------- */

async function buyAvatarItemCore(data, claims, authUid) {
  const schoolId = String(data?.schoolId ?? "").trim();
  requireSchoolMatch(schoolId, claims);

  const userId = String(claims.userId || authUid || "").trim().toLowerCase();
  const role = String(claims.role || "").toLowerCase();
  const itemId = String(data?.itemId ?? "").trim();

  if (!userId) {
    throw new functions.https.HttpsError("failed-precondition", "Missing userId.");
  }
  if (!itemId) {
    throw new functions.https.HttpsError("invalid-argument", "Missing itemId.");
  }

  if (!["student", "staff", "admin"].includes(role)) {
    throw new functions.https.HttpsError("permission-denied", "Invalid role.");
  }

  const userRef = db.doc(`${schoolRoot(schoolId)}/users/${userId}`);
  const summaryRef = db.doc(`${schoolRoot(schoolId)}/users/${userId}/readathon/summary`);
  const inventoryRef = db.doc(
    `${schoolRoot(schoolId)}/users/${userId}/readathon/summary/inventory/${itemId}`
  );
  const catalogRef = db.doc(`${schoolRoot(schoolId)}/avatarCatalog/catalog/items/${itemId}`);
  const txRef = db.collection(`${schoolRoot(schoolId)}/transactions`).doc();

  let itemDataOut = null;

  await db.runTransaction(async (t) => {
    const [userSnap, summarySnap, inventorySnap, catalogSnap] = await Promise.all([
      t.get(userRef),
      t.get(summaryRef),
      t.get(inventoryRef),
      t.get(catalogRef),
    ]);

    if (!userSnap.exists) {
      throw new functions.https.HttpsError("not-found", "User not found.");
    }

    if (userSnap.data()?.active !== true) {
      throw new functions.https.HttpsError("failed-precondition", "User inactive.");
    }

    if (!catalogSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Catalog item not found.");
    }

    if (inventorySnap.exists) {
      throw new functions.https.HttpsError("already-exists", "Item already owned.");
    }

    const item = catalogSnap.data() || {};
    itemDataOut = item;

    if (item.active === false) {
      throw new functions.https.HttpsError("failed-precondition", "Item is inactive.");
    }

    const price = Number(item.price ?? item.cost ?? 0);
    if (!Number.isFinite(price) || price < 0) {
      throw new functions.https.HttpsError("failed-precondition", "Invalid item price.");
    }

    const slot = normalizeCatalogSlot(item);
    const allowedSlots = new Set([
      "background",
      "pet",
      "wall",
      "floor",
      "base",
      "head",
      "accessory",
    ]);

    if (!allowedSlots.has(slot)) {
      throw new functions.https.HttpsError("failed-precondition", "Item slot is not purchasable.");
    }

    const summary = summarySnap.exists ? summarySnap.data() : defaultSummary();
    const rubiesBalance = Number(summary.rubiesBalance || 0);

    if (rubiesBalance < price) {
      throw new functions.https.HttpsError("failed-precondition", "Not enough rubies.");
    }

    summary.rubiesBalance = rubiesBalance - price;
    summary.rubiesLifetimeSpent = Number(summary.rubiesLifetimeSpent || 0) + price;

    t.set(
      summaryRef,
      {
        rubiesBalance: summary.rubiesBalance,
        rubiesLifetimeSpent: summary.rubiesLifetimeSpent,
      },
      { merge: true }
    );

    t.set(
      inventoryRef,
      {
        owned: true,
        itemId,
        slot,
        source: "shop",
        pricePaid: price,
        purchasedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    t.set(
      txRef,
      {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        dateKey: todayDateKey(),
        targetUserId: userId,
        submittedByUserId: userId,
        actionType: "RUBIES_SPEND",
        deltaMinutes: 0,
        deltaRubies: -price,
        deltaMoneyRaisedCents: 0,
        note: `Bought avatar item ${itemId}`.slice(0, 300),
        source: "avatar_shop",
        status: "POSTED",
        avatarItemId: itemId,
        avatarItemSlot: slot,
      },
      { merge: true }
    );
  });

  return {
    ok: true,
    itemId,
    slot: normalizeCatalogSlot(itemDataOut || {}),
  };
}

/* --------------------------------------------------
   HTTP Endpoints (Bearer token + CORS)
-------------------------------------------------- */

exports.submitTransactionHttp = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("POST only");

      const claims = await verifyBearerToken(req);

      console.log("submitTransactionHttp HIT", {
        uid: claims.user_id || claims.sub,
        role: claims.role,
        schoolId: claims.schoolId,
      });

      const result = await submitTransactionCore(req.body || {}, claims, claims.user_id || claims.sub);
      return res.status(200).json(result);
    } catch (err) {
      console.error("submitTransactionHttp error:", err);
      const status = err instanceof functions.https.HttpsError ? httpsErrorToStatus(err) : 500;
      return res.status(status).json({ error: err?.message || "Error" });
    }
  });
});

exports.awardHomeroomHttp = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("POST only");

      const claims = await verifyBearerToken(req);

      console.log("awardHomeroomHttp HIT", {
        uid: claims.user_id || claims.sub,
        role: claims.role,
        schoolId: claims.schoolId,
      });

      const result = await awardHomeroomCore(req.body || {}, claims, claims.user_id || claims.sub);
      return res.status(200).json(result);
    } catch (err) {
      console.error("awardHomeroomHttp error:", err);
      const status = err instanceof functions.https.HttpsError ? httpsErrorToStatus(err) : 500;
      return res.status(status).json({ error: err?.message || "Error" });
    }
  });
});

exports.approvePendingMinutesHttp = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    try {
      if (req.method !== "POST") return res.status(405).send("POST only");

      const claims = await verifyBearerToken(req);

      console.log("approvePendingMinutesHttp HIT", {
        uid: claims.user_id || claims.sub,
        role: claims.role,
        schoolId: claims.schoolId,
      });

      const result = await approvePendingMinutesCore(req.body || {}, claims, claims.user_id || claims.sub);
      return res.status(200).json(result);
    } catch (err) {
      console.error("approvePendingMinutesHttp error:", err);
      const status = err instanceof functions.https.HttpsError ? httpsErrorToStatus(err) : 500;
      return res.status(status).json({ error: err?.message || "Error" });
    }
  });
});

/* --------------------------------------------------
   Callable Functions
-------------------------------------------------- */

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
    if (!userSnap.exists) throw new functions.https.HttpsError("not-found", "User not found.");

    const userData = userSnap.data() || {};
    if (userData.active !== true) {
      throw new functions.https.HttpsError("failed-precondition", "User inactive.");
    }

    // ✅ PIN hashes stored here:
    // readathonV2_schools/{schoolId}/secrets/{userId}
    const secRef = db.doc(`${schoolRoot(schoolId)}/secrets/${userId}`);
    const secSnap = await secRef.get();
    if (!secSnap.exists) throw new functions.https.HttpsError("not-found", "PIN not set.");

    const pinHash = secSnap.data()?.pinHash;
    if (typeof pinHash !== "string" || pinHash.length < 10) {
      throw new functions.https.HttpsError("failed-precondition", "PIN hash invalid (reset PIN).");
    }

    const ok = await bcrypt.compare(pin, pinHash);
    if (!ok) throw new functions.https.HttpsError("permission-denied", "Invalid PIN.");

    const role = inferRole(userId, userData.role);

    const customToken = await admin.auth().createCustomToken(userId, {
      schoolId,
      userId,
      role,
    });

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
  console.log("submitTransaction HIT", { hasAuth: !!context.auth, uid: context.auth?.uid });
  const auth = requireAuth(context);
  const claims = auth.token || {};
  return submitTransactionCore(data, claims, auth.uid);
});

/**
 * Callable: awardHomeroom({...})
 */
exports.awardHomeroom = functions.https.onCall(async (data, context) => {
  const auth = requireAuth(context);
  const claims = auth.token || {};
  return awardHomeroomCore(data, claims, auth.uid);
});

/**
 * Callable: approvePendingMinutes({ schoolId, txId })
 */
exports.approvePendingMinutes = functions.https.onCall(async (data, context) => {
  const auth = requireAuth(context);
  const claims = auth.token || {};
  return approvePendingMinutesCore(data, claims, auth.uid);
});

/**
 * Callable: buyAvatarItem({ schoolId, itemId })
 */
exports.buyAvatarItem = functions.https.onCall(async (data, context) => {
  const req = (data && typeof data === "object" && data.data && data.auth)
    ? data
    : null;

  const auth = req?.auth || context?.auth || null;
  const payload = req?.data || data || {};

  console.log("buyAvatarItem HIT", {
    hasAuth: !!auth,
    uid: auth?.uid,
    tokenUserId: auth?.token?.userId,
    tokenRole: auth?.token?.role,
    tokenSchoolId: auth?.token?.schoolId,
    payload,
  });

  if (!auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  const claims = auth.token || {};
  return buyAvatarItemCore(payload, claims, auth.uid);
});

/* --------------------------------------------------
   PUBLIC LEADERBOARD (AUTO)
   Sources:
   - publicStudents/{uid}: active, displayName, grade, homeroomId
   - users/{uid}/readathon/summary: minutesTotal
   Output:
   - leaderboards/public doc: topHomerooms, topGrades, topStudents
-------------------------------------------------- */

async function rebuildPublicLeaderboardCore(schoolId) {
  const pubSnap = await db
    .collection(`${schoolRoot(schoolId)}/publicStudents`)
    .where("active", "==", true)
    .get();

  const pubStudents = pubSnap.docs.map((d) => ({
    uid: d.id,
    displayName: d.get("displayName") || "",
    grade: d.get("grade"),
    homeroomId: d.get("homeroomId") || "",
  }));

  const pubByUid = new Map(pubStudents.map((s) => [s.uid, s]));

  const summaryRefs = pubStudents.map((s) =>
    db.doc(`${schoolRoot(schoolId)}/users/${s.uid}/readathon/summary`)
  );

  const homeroomTotals = new Map();
  const gradeTotals = new Map();
  const students = [];

  const refChunks = chunkArray(summaryRefs, 300);

  for (const refs of refChunks) {
    const snaps = await db.getAll(...refs);

    for (const sumSnap of snaps) {
      const m = sumSnap.ref.path.match(/\/users\/([^/]+)\/readathon\/summary$/);
      const uid = m ? m[1] : null;
      if (!uid) continue;

      const pub = pubByUid.get(uid);
      if (!pub) continue;

      const minutesTotal = Number(sumSnap.get("minutesTotal") || 0);

      students.push({
        userId: uid,
        displayNamePublic: toPublicName(pub.displayName) || uid,
        grade: pub.grade ?? null,
        homeroomId: pub.homeroomId || null,
        minutes: minutesTotal,
      });

      if (pub.homeroomId) {
        homeroomTotals.set(pub.homeroomId, (homeroomTotals.get(pub.homeroomId) || 0) + minutesTotal);
      }

      const gKey = pub.grade === 0 || pub.grade ? String(pub.grade) : "";
      if (gKey !== "") {
        gradeTotals.set(gKey, (gradeTotals.get(gKey) || 0) + minutesTotal);
      }
    }
  }

  students.sort((a, b) => b.minutes - a.minutes);
  const topStudents = students.slice(0, 5);

  const topHomerooms = Array.from(homeroomTotals.entries())
    .map(([homeroomId, minutes]) => ({ homeroomId, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 5);

  const topGrades = Array.from(gradeTotals.entries())
    .map(([grade, minutes]) => ({
      grade: Number.isFinite(Number(grade)) ? Number(grade) : grade,
      minutes,
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const outRef = db.doc(`${schoolRoot(schoolId)}/leaderboards/public`);
  await outRef.set(
    {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      schoolId,
      topHomerooms,
      topGrades,
      topStudents,
    },
    { merge: true }
  );

  return {
    ok: true,
    counts: {
      activePublicStudents: pubStudents.length,
      topHomerooms: topHomerooms.length,
      topGrades: topGrades.length,
      topStudents: topStudents.length,
    },
  };
}

/**
 * ✅ Automatic rebuild every 15 minutes
 */
exports.rebuildPublicLeaderboardScheduled = onSchedule(
  { schedule: "every 15 minutes", timeZone: "America/Chicago" },
  async () => {
    const schoolId = "308_longbeach_elementary";
    console.log("Scheduled leaderboard rebuild start", { schoolId });
    const result = await rebuildPublicLeaderboardCore(schoolId);
    console.log("Scheduled leaderboard rebuild done", result);
  }
);

/**
 * Optional: manual callable
 * rebuildPublicLeaderboard({ schoolId })
 */
exports.rebuildPublicLeaderboard = functions.https.onCall(async (data, context) => {
  const auth = requireAuth(context);
  const claims = auth.token || {};
  const role = String(claims.role || "").toLowerCase();

  if (role !== "admin" && role !== "staff") {
    throw new functions.https.HttpsError("permission-denied", "Staff/Admin only.");
  }

  const schoolId = String(data?.schoolId || claims.schoolId || "308_longbeach_elementary").trim();
  requireSchoolMatch(schoolId, claims);

  return rebuildPublicLeaderboardCore(schoolId);
});