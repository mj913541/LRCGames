// -------------------------------------------------------------
// LRC Quest Core - Shared Logic for All Pages
// Supports:
// - Anonymous students (homeroom / grade / PIN / username)
// - Google Admin (Mrs. A ONLY)
// -------------------------------------------------------------

// -------------------------------------------------------------
// Firebase imports (modular v12.6.0)
// -------------------------------------------------------------

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// -------------------------------------------------------------
// Firebase Configuration (YOUR PROJECT)
// -------------------------------------------------------------

const firebaseConfig = {
  apiKey: "AIzaSyDTKYFcm26i0LsrLo9UjtLnZpNKx4XsWG4",
  authDomain: "lrcquest-3039e.firebaseapp.com",
  projectId: "lrcquest-3039e",
  storageBucket: "lrcquest-3039e.firebasestorage.app",
  messagingSenderId: "72063656342",
  appId: "1:72063656342:web:bc08c6538437f50b53bdb7"
};

// -------------------------------------------------------------
// Initialize Firebase (ONCE)
// -------------------------------------------------------------

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// -------------------------------------------------------------
// Constants
// -------------------------------------------------------------

const ADMIN_EMAIL = "malbrecht3317@gmail.com";

// -------------------------------------------------------------
// Local Storage Helpers (Students)
// -------------------------------------------------------------

export function getLocalStudent() {
  try {
    return JSON.parse(localStorage.getItem("lrcQuestStudent")) || null;
  } catch {
    return null;
  }
}

export function setLocalStudent(student) {
  localStorage.setItem("lrcQuestStudent", JSON.stringify(student));
}

export function getLocalProgress() {
  try {
    return JSON.parse(localStorage.getItem("lrcQuestProgress")) || {};
  } catch {
    return {};
  }
}

export function setLocalProgress(progress) {
  localStorage.setItem("lrcQuestProgress", JSON.stringify(progress));
}

export function getLocalTier() {
  return localStorage.getItem("lrcQuestTier") || "free";
}

export function setLocalTier(tier) {
  localStorage.setItem("lrcQuestTier", tier);
}

// -------------------------------------------------------------
// Role Helpers
// -------------------------------------------------------------

export function isAdminUser(user = auth.currentUser) {
  const email = (user?.email || "").toLowerCase();
  return email === ADMIN_EMAIL;
}

export function isAnonStudent(user = auth.currentUser) {
  return !!user && !user.email;
}

// -------------------------------------------------------------
// Sign-in Helpers
// -------------------------------------------------------------

// Student login (after PIN / homeroom check on UI)
export async function signInStudentAnonymously() {
  return await signInAnonymously(auth);
}

// Admin login (Google – Gmail ONLY)
export async function signInAdminWithGoogle() {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);

  const email = (result.user?.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL) {
    await signOut(auth);
    throw new Error("NOT_AUTHORIZED_ADMIN");
  }

  return result;
}

// -------------------------------------------------------------
// Require Login Guard
// -------------------------------------------------------------
// - Allows anonymous students OR Google admin
// - Redirects if not signed in
// -------------------------------------------------------------

export function requireLogin(callback) {
  onAuthStateChanged(auth, (user) => {
    if (!user) {
      window.location.href = "login.html";
      return;
    }

    const role = isAdminUser(user) ? "admin" : "student";
    callback(user, role);
  });
}

// -------------------------------------------------------------
// Load or Create Player Document
// -------------------------------------------------------------

export async function loadOrCreatePlayer(uid, profile = {}) {
  const ref = doc(db, "players", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const newData = {
      profile: {
        username: profile.username || "",
        fullName: profile.fullName || "",
        grade: profile.grade || "",
        homeroom: profile.homeroom || ""
      },
      progress: {},
      subscriptionTier: "free",
      createdAt: Date.now()
    };

    await setDoc(ref, newData);
    return newData;
  }

  const data = snap.data() || {};
  if (!data.profile) data.profile = {};
  if (!data.progress) data.progress = {};
  if (!data.subscriptionTier) data.subscriptionTier = "free";

  return data;
}

// -------------------------------------------------------------
// Save Progress Update
// -------------------------------------------------------------

export async function saveProgress(updateFn) {
  const user = auth.currentUser;
  const student = getLocalStudent();

  if (!user || !student) {
    console.warn("Not logged in / no student data.");
    return;
  }

  const current = getLocalProgress();
  const updated = updateFn(current);

  // Save locally
  setLocalProgress(updated);

  // Save to Firestore
  const ref = doc(db, "players", user.uid);
  await setDoc(
    ref,
    {
      profile: {
        username: student.username || "",
        fullName: student.fullName || "",
        grade: student.grade || "",
        homeroom: student.homeroom || ""
      },
      progress: updated,
      lastSeenAt: Date.now()
    },
    { merge: true }
  );
}

// -------------------------------------------------------------
// Logout Helper
// -------------------------------------------------------------

export async function logOut() {
  const wasAdmin = isAdminUser(auth.currentUser);

  await signOut(auth);

  localStorage.removeItem("lrcQuestStudent");
  localStorage.removeItem("lrcQuestProgress");
  localStorage.removeItem("lrcQuestTier");

  window.location.href = wasAdmin ? "adminLogin.html" : "login.html";
}
