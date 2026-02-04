// /readathonWorld/scripts/readathonCore.js
// Shared utilities for Read-A-Thon World (static site, ES modules).
// ✅ Uses existing Firebase instances from /scripts/lrcQuestCore.js (do NOT reinitialize Firebase)

import { auth, db } from "../../scripts/lrcQuestCore.js";

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";
import {
  doc,
  getDoc,
  onSnapshot,
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  increment,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// =============================
// CONFIG (EDIT THIS)
// =============================

// 🔧 Set this to your existing profile collection name:
// examples: "users" OR "players" OR "students"
export const READATHON_PROFILE_COLLECTION = "users";

export const COLLECTIONS = {
  requests: "readathonRequests",
  sparkShop: "readathonSparkShop",
  prizeStore: "readathonPrizeStore"
};

// =============================
// AUTH / ROUTING
// =============================
export function requireAuthOrRedirect(loginPath = "/scripts/login/login.html", redirectTo = null) {
  // If your login lives elsewhere, set loginPath accordingly.
  // redirectTo: relative path from site root, like "readathonWorld/dashboard.html"
  return new Promise((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) return resolve(user);

      const dest = redirectTo || defaultRedirectFromLocation();
      const url = `${loginPath}?redirect=${encodeURIComponent(dest)}`;
      window.location.href = url;
    });
  });
}

function defaultRedirectFromLocation() {
  // Convert current location to a root-relative path for redirect param
  const { pathname, search, hash } = window.location;
  // drop leading slash
  const p = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return `${p}${search || ""}${hash || ""}`;
}

// =============================
// PROFILE
// =============================
export function profileRef(uid) {
  return doc(db, READATHON_PROFILE_COLLECTION, uid);
}

export async function getProfile(uid) {
  const snap = await getDoc(profileRef(uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export function watchProfile(uid, cb) {
  return onSnapshot(profileRef(uid), (snap) => {
    cb(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  });
}

export function roleOf(profile) {
  return (profile?.role || "student").toLowerCase();
}

export function isStaffOrAdmin(profile) {
  const r = roleOf(profile);
  return r === "staff" || r === "admin";
}

// =============================
// REQUESTS (student creates)
// =============================
export async function createReadathonRequest({ uid, type, delta = {}, item = null, studentNote = "" }) {
  if (!uid) throw new Error("Missing uid for request.");

  const payload = {
    uid,
    type,
    status: "pending",
    delta,
    item: item || null,
    studentNote: (studentNote || "").slice(0, 300),
    createdAt: serverTimestamp()
  };

  await addDoc(collection(db, COLLECTIONS.requests), payload);
}

export async function fetchMyRequests(uid, max = 25) {
  const q = query(
    collection(db, COLLECTIONS.requests),
    where("uid", "==", uid),
    orderBy("createdAt", "desc"),
    limit(max)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =============================
// SHOPS
// =============================
export async function fetchShopItems(shopCollectionName) {
  const q = query(
    collection(db, shopCollectionName),
    where("active", "==", true),
    orderBy("sort", "asc"),
    limit(200)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// =============================
// ADMIN: Approve / Deny requests
// =============================

export async function fetchPendingRequests(max = 50) {
  const q = query(
    collection(db, COLLECTIONS.requests),
    where("status", "==", "pending"),
    orderBy("createdAt", "asc"),
    limit(max)
  );

  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveRequest({ requestId, staffUid, staffNote = "" }) {
  const reqRef = doc(db, COLLECTIONS.requests, requestId);

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Request not found.");

    const req = reqSnap.data();
    if (req.status !== "pending") throw new Error("Request already decided.");

    const studentUid = req.uid;
    const profRef = profileRef(studentUid);
    const profSnap = await tx.get(profRef);
    if (!profSnap.exists()) throw new Error("Student profile missing.");

    // Compute increments based on request type
    const updates = {};
    const now = serverTimestamp();

    // Ensure readathon object exists; we'll just write nested fields.
    if (req.type === "minutes") {
      const add = Number(req.delta?.minutesAdd || 0);
      if (add <= 0 || add > 600) throw new Error("Invalid minutesAdd.");
      updates["readathon.minutesRead"] = increment(add);

      // Optional: sparks earned logic (edit this to match your program)
      // Example: 1 spark per 10 minutes
      const sparks = Math.floor(add / 10);
      if (sparks > 0) updates["readathon.sparksEarned"] = increment(sparks);

    } else if (req.type === "donation") {
      const add = Number(req.delta?.moneyAdd || 0);
      if (add <= 0 || add > 1000) throw new Error("Invalid moneyAdd.");
      updates["readathon.moneyRaised"] = increment(add);

      // Optional: spark reward per dollar
      // Example: 2 sparks per $1
      const sparks = Math.floor(add * 2);
      if (sparks > 0) updates["readathon.sparksEarned"] = increment(sparks);

    } else if (req.type === "sparkPurchase") {
      // Purchase costs sparks; item is cosmetic
      const cost = Number(req.item?.costSparks || 0);
      if (cost <= 0 || cost > 10000) throw new Error("Invalid spark cost.");
      updates["readathon.sparksEarned"] = increment(-cost);

      // Record ownership (array union would be ideal, but requires import)
      // We'll store ownership in an "ownedItems" array by updating the whole array is riskier.
      // Instead: store cosmetics as map flags (safe to merge).
      const ownedKey = `avatar.ownedItemsMap.${req.item.itemId}`;
      updates[ownedKey] = true;

    } else if (req.type === "prizeRedemption") {
      const cost = Number(req.item?.costMoney || 0);
      if (cost <= 0 || cost > 1000) throw new Error("Invalid prize cost.");
      updates["readathon.moneyRaised"] = increment(-cost);

      // Track redemptions as map flags (or later: subcollection ledger)
      const redeemedKey = `readathon.redeemedMap.${req.item.itemId}.${requestId}`;
      updates[redeemedKey] = {
        name: req.item?.name || "Prize",
        costMoney: cost,
        at: now
      };
    } else {
      throw new Error("Unknown request type.");
    }

    updates["readathon.lastUpdatedAt"] = now;

    tx.update(profRef, updates);

    tx.update(reqRef, {
      status: "approved",
      decidedAt: now,
      decidedBy: staffUid,
      staffNote: (staffNote || "").slice(0, 500)
    });
  });
}

export async function denyRequest({ requestId, staffUid, staffNote = "" }) {
  const reqRef = doc(db, COLLECTIONS.requests, requestId);

  await runTransaction(db, async (tx) => {
    const reqSnap = await tx.get(reqRef);
    if (!reqSnap.exists()) throw new Error("Request not found.");
    const req = reqSnap.data();
    if (req.status !== "pending") throw new Error("Request already decided.");

    tx.update(reqRef, {
      status: "denied",
      decidedAt: serverTimestamp(),
      decidedBy: staffUid,
      staffNote: (staffNote || "").slice(0, 500)
    });
  });
}

// =============================
// UI helpers
// =============================
export function fmtMoney(n) {
  const num = Number(n || 0);
  return `$${num.toFixed(2)}`;
}

export function fmtInt(n) {
  return `${Math.max(0, Math.floor(Number(n || 0)))}`;
}

export function safeText(s) {
  return (s ?? "").toString();
}

export function toast(msg, type = "info") {
  const el = document.getElementById("toast");
  if (!el) return alert(msg);

  el.textContent = msg;
  el.classList.remove("hidden");
  el.dataset.type = type;

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}
