// /readathon-world_Ver2/js/firebase.js
// Firebase v9+ (modular) via CDN. Vanilla JS module exports.
// NOTE: This keeps your existing Firebase initialization (single initializeApp).
// It also fixes fnBuyAvatarItem to use the SAME regional Functions instance.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";

import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import {
  getFunctions,
  httpsCallable,
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";

console.log("✅ LOADED firebase.js: V2 /readathon-world_Ver2/js/firebase.js");

/* --------------------------------------------------
   Firebase Config
-------------------------------------------------- */

const firebaseConfig = {
  apiKey: "AIzaSyDpXoneclJAl5kFr7doJmSlgqoN6teGWzI",
  authDomain: "lrcquest-3039e.web.app",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:e355f9119293b3d953bdb7",
  measurementId: "G-VRKVK0QWY2",
};

export const DEFAULT_SCHOOL_ID = "308_longbeach_elementary";

/* --------------------------------------------------
   Initialize Firebase (SINGLE initialization)
-------------------------------------------------- */

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ✅ Make login persist across page loads
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("⚠️ setPersistence failed:", err);
});

export const db = getFirestore(app);

// ✅ Keep a SINGLE Functions instance with explicit region
export const functions = getFunctions(app, "us-central1");

/* --------------------------------------------------
   Callable Cloud Functions (onCall)
   IMPORTANT: use httpsCallable(functions, "...") (NOT the .a.run.app URL)
-------------------------------------------------- */

export const fnVerifyPin = httpsCallable(functions, "verifyPin");
export const fnSubmitTransaction = httpsCallable(functions, "submitTransaction");
export const fnAwardHomeroom = httpsCallable(functions, "awardHomeroom");
export const fnApprovePendingMinutes = httpsCallable(functions, "approvePendingMinutes");

// Avatar World (Option 1 rules: function-owned summary + inventory)
export const fnBuyAvatarItem = httpsCallable(functions, "buyAvatarItem");

/* --------------------------------------------------
   School ID Helpers
-------------------------------------------------- */

export function getSchoolId() {
  return localStorage.getItem("readathonV2_schoolId") || DEFAULT_SCHOOL_ID;
}

export function setSchoolId(schoolId) {
  localStorage.setItem("readathonV2_schoolId", schoolId);
}

/* --------------------------------------------------
   Auth Helpers
-------------------------------------------------- */

// Sign in with custom token + force-refresh claims
export async function signInWithToken(customToken) {
  const cred = await signInWithCustomToken(auth, customToken);
  await cred.user.getIdToken(true); // Ensure claims are immediately available
  return cred;
}

export async function signOutUser() {
  await signOut(auth);
}

// Wait until Firebase finishes loading the signed-in user
export function waitForAuthReady() {
  return new Promise((resolve) => {
    const unsub = onAuthStateChanged(auth, (user) => {
      unsub();
      resolve(user);
    });
  });
}

// Get ID token claims
export async function getIdTokenClaims(forceRefresh = false) {
  const u = auth.currentUser;
  if (!u) return null;
  const tokenResult = await u.getIdTokenResult(forceRefresh);
  return tokenResult?.claims || null;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/* --------------------------------------------------
   Basic Guards (app.js uses its own stronger guard)
-------------------------------------------------- */

export async function requireSignedIn({
  redirectTo = "/readathon-world_Ver2/html/index.html",
} = {}) {
  if (!auth.currentUser) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export async function requireRole(
  allowedRoles = [],
  { redirectTo = "/readathon-world_Ver2/html/index.html" } = {}
) {
  const ok = await requireSignedIn({ redirectTo });
  if (!ok) return false;

  let claims = await getIdTokenClaims(false);
  if (!claims?.role) claims = await getIdTokenClaims(true);

  if (!claims?.role || !allowedRoles.includes(claims.role)) {
    window.location.href = redirectTo;
    return false;
  }

  return true;
}

/* --------------------------------------------------
   Firestore Path Helpers
-------------------------------------------------- */

export function schoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

export function userDocRef(schoolId, userId) {
  return doc(db, `${schoolRoot(schoolId)}/users/${userId}`);
}

// CONFIRMED summary path:
// readathonV2_schools/{schoolId}/users/{userId}/readathon/summary
export function userSummaryRef(schoolId, userId) {
  return doc(
    db,
    "readathonV2_schools",
    schoolId,
    "users",
    userId,
    "readathon",
    "summary"
  );
}

export function publicStudentsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/publicStudents`);
}

export function homeroomsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/homerooms`);
}

export function transactionsCol(schoolId) {
  return collection(db, `${schoolRoot(schoolId)}/transactions`);
}

/* --------------------------------------------------
   Read Helpers
-------------------------------------------------- */

export async function fetchActivePublicStudentsByGrade(schoolId, gradeNum) {
  const qRef = query(
    publicStudentsCol(schoolId),
    where("active", "==", true),
    where("grade", "==", gradeNum),
    orderBy("homeroomId"),
    orderBy("displayName"),
    limit(5000)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function fetchActiveHomeroomsByGrade(schoolId, gradeNum) {
  const qRef = query(
    homeroomsCol(schoolId),
    where("active", "==", true),
    where("grade", "==", gradeNum),
    orderBy("homeroomId"),
    limit(500)
  );

  const snap = await getDocs(qRef);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function fetchActivePublicStudentsByHouse(schoolId, houseId) {
  const pub = collection(db, `readathonV2_schools/${schoolId}/publicStudents`);
  const qy = query(
    pub,
    where("active", "==", true),
    where("houseId", "==", String(houseId || "").trim())
  );

  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function fetchUserSummary(schoolId, userId) {
  const ref = userSummaryRef(schoolId, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}
