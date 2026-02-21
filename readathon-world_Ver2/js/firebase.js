// /readathon-world_Ver2/js/firebase.js
// Firebase v9+ (modular) via CDN. Vanilla JS module exports.
// IMPORTANT: Replace firebaseConfig placeholders with your real config.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithCustomToken,
  signOut,
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

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDpXoneclJAl5kFr7doJmSlgqoN6teGWzI",
  authDomain: "lrcquest-3039e.web.app",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:e355f9119293b3d953bdb7",
  measurementId: "G-VRKVK0QWY2"
};

export const DEFAULT_SCHOOL_ID = "308_longbeach_elementary";

// Initialize
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

/**
 * Callable Cloud Functions
 */
export const fnVerifyPin = httpsCallable(functions, "verifyPin");
export const fnSubmitTransaction = httpsCallable(functions, "submitTransaction");
export const fnAwardHomeroom = httpsCallable(functions, "awardHomeroom");
export const fnApprovePendingMinutes = httpsCallable(functions, "approvePendingMinutes");

/**
 * Convenience: read schoolId from localStorage (fallback to default)
 */
export function getSchoolId() {
  return localStorage.getItem("readathonV2_schoolId") || DEFAULT_SCHOOL_ID;
}
export function setSchoolId(schoolId) {
  localStorage.setItem("readathonV2_schoolId", schoolId);
}

/**
 * Convenience: sign in with custom token returned from verifyPin
 */
export async function signInWithToken(customToken) {
  const cred = await signInWithCustomToken(auth, customToken);
  return cred;
}

export async function signOutUser() {
  await signOut(auth);
}

/**
 * Claims helpers
 */
export async function getIdTokenClaims(forceRefresh = false) {
  const u = auth.currentUser;
  if (!u) return null;
  const tokenResult = await u.getIdTokenResult(forceRefresh);
  return tokenResult?.claims || null;
}

export function watchAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Guards
 */
export async function requireSignedIn({ redirectTo = "/readathon-world_Ver2/html/index.html" } = {}) {
  if (!auth.currentUser) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

export async function requireRole(allowedRoles = [], { redirectTo = "/readathon-world_Ver2/html/index.html" } = {}) {
  const ok = await requireSignedIn({ redirectTo });
  if (!ok) return false;
  const claims = await getIdTokenClaims();
  if (!claims?.role || !allowedRoles.includes(claims.role)) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

/**
 * Firestore path helpers
 */
export function schoolRoot(schoolId) {
  return `readathonV2_schools/${schoolId}`;
}

export function userDocRef(schoolId, userId) {
  return doc(db, `${schoolRoot(schoolId)}/users/${userId}`);
}

export function userSummaryRef(schoolId, userId) {
  return doc(db, `${schoolRoot(schoolId)}/users/${userId}/readathon/summary`);
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

/**
 * Read helpers (used for login pickers, dashboards, etc.)
 */
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

export async function fetchUserSummary(schoolId, userId) {
  const ref = userSummaryRef(schoolId, userId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}